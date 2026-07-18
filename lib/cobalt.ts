import { createHash } from "crypto";
import type { MediaDownload, MediaKind, NormalizedMedia, PlatformInfo } from "@/types/download";

const REQUEST_TIMEOUT_MS = 45_000;

type CobaltStatus = "tunnel" | "redirect" | "picker" | "local-processing" | "error";

interface CobaltBaseResponse {
  status?: CobaltStatus | string;
}

interface CobaltFileResponse extends CobaltBaseResponse {
  status: "tunnel" | "redirect";
  url: string;
  filename?: string;
}

interface CobaltPickerItem {
  type?: "photo" | "video" | "gif" | string;
  url?: string;
  thumb?: string;
}

interface CobaltPickerResponse extends CobaltBaseResponse {
  status: "picker";
  audio?: string;
  audioFilename?: string;
  picker?: CobaltPickerItem[];
}

interface CobaltErrorResponse extends CobaltBaseResponse {
  status: "error";
  error?: {
    code?: string;
    context?: Record<string, unknown>;
  };
}

export interface CobaltResult {
  ok: boolean;
  status: number;
  media?: NormalizedMedia;
  error?: string;
}

function apiBase() {
  return (process.env.COBALT_API_URL || "").trim().replace(/\/+$/, "");
}

function extensionFromFilename(filename = "") {
  const clean = filename.split("?")[0].split("#")[0];
  const match = clean.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase();
}

function mediaKind(filename: string | undefined, fallback: MediaKind = "video"): MediaKind {
  const extension = extensionFromFilename(filename || "");
  if (["mp4", "webm", "mov", "m4v", "mkv"].includes(extension || "")) return "video";
  if (["mp3", "m4a", "aac", "wav", "ogg", "opus", "flac"].includes(extension || "")) return "audio";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension || "")) return "image";
  return fallback;
}

function cleanFilename(filename?: string) {
  if (!filename) return undefined;
  try {
    return decodeURIComponent(filename).replace(/[\\/]+/g, " ").trim();
  } catch {
    return filename.replace(/[\\/]+/g, " ").trim();
  }
}

function titleFromFilename(filename: string | undefined, platform: PlatformInfo) {
  const clean = cleanFilename(filename);
  if (!clean) return `${platform.name} media`;
  return clean.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim() || `${platform.name} media`;
}

function createDownload(url: string, kind: MediaKind, filename: string | undefined, label: string): MediaDownload {
  const extension = extensionFromFilename(filename || url);
  return {
    id: createHash("sha1").update(`${url}:${label}`).digest("hex").slice(0, 12),
    kind,
    url,
    label,
    format: extension?.toUpperCase(),
  };
}

function errorMessage(code?: string) {
  const known: Record<string, string> = {
    "error.api.auth.api_key.missing": "Backend Cobalt meminta API key, tetapi COBALT_API_KEY belum diatur di Vercel.",
    "error.api.auth.api_key.invalid": "COBALT_API_KEY ditolak oleh backend Cobalt.",
    "error.api.auth.jwt.missing": "Backend Cobalt meminta autentikasi tambahan.",
    "error.api.rate_limit": "Backend downloader sedang terkena batas permintaan. Coba lagi beberapa saat.",
    "error.api.service.unsupported": "Platform ini belum didukung oleh backend downloader.",
    "error.api.link.invalid": "Tautan tidak valid atau medianya tidak publik.",
    "error.api.fetch.empty": "Backend tidak menemukan media yang dapat diunduh dari tautan tersebut.",
  };

  if (!code) return "Backend downloader mengembalikan respons error tanpa keterangan.";
  return known[code] || `Backend downloader gagal memproses media (${code}).`;
}

function normalizeCobalt(data: CobaltBaseResponse, platform: PlatformInfo): CobaltResult {
  if (data.status === "redirect" || data.status === "tunnel") {
    const response = data as CobaltFileResponse;
    if (!response.url) return { ok: false, status: 502, error: "Backend tidak mengirim tautan media." };

    const filename = cleanFilename(response.filename);
    const kind = mediaKind(filename, platform.id === "soundcloud" ? "audio" : "video");
    const download = createDownload(response.url, kind, filename, kind === "audio" ? "Audio" : "Media utama");

    return {
      ok: true,
      status: 200,
      media: {
        title: titleFromFilename(filename, platform),
        platform,
        description: "Media diproses melalui backend Cobalt milik sendiri.",
        preview: {
          video: kind === "video" ? response.url : undefined,
          audio: kind === "audio" ? response.url : undefined,
          image: kind === "image" ? response.url : undefined,
        },
        downloads: [download],
        gallery: kind === "file" ? undefined : [{ id: `${download.id}-gallery`, kind, url: response.url, label: download.label }],
        contentType: kind === "audio" ? "Audio" : kind === "image" ? "Gambar" : "Video",
        provider: "Cobalt",
      },
    };
  }

  if (data.status === "picker") {
    const response = data as CobaltPickerResponse;
    const downloads: MediaDownload[] = [];
    let firstImage: string | undefined;
    let firstVideo: string | undefined;

    for (const [index, item] of (response.picker || []).entries()) {
      if (!item.url) continue;
      const kind: MediaKind = item.type === "photo" ? "image" : item.type === "gif" ? "image" : "video";
      const filename = `${platform.shortName.toLowerCase()}-${index + 1}.${kind === "image" ? (item.type === "gif" ? "gif" : "jpg") : "mp4"}`;
      downloads.push(createDownload(item.url, kind, filename, `${kind === "image" ? "Gambar" : "Video"} ${index + 1}`));
      if (kind === "image" && !firstImage) firstImage = item.thumb || item.url;
      if (kind === "video" && !firstVideo) firstVideo = item.url;
    }

    if (response.audio) {
      downloads.push(createDownload(response.audio, "audio", response.audioFilename || "audio.mp3", "Audio latar"));
    }

    if (downloads.length === 0) return { ok: false, status: 422, error: "Backend merespons, tetapi daftar medianya kosong." };

    return {
      ok: true,
      status: 200,
      media: {
        title: `${platform.name} media`,
        platform,
        description: "Postingan berisi beberapa media. Pilih berkas yang ingin disimpan.",
        preview: {
          video: firstVideo,
          audio: !firstVideo ? response.audio : undefined,
          image: !firstVideo ? firstImage : undefined,
        },
        downloads,
        gallery: downloads.filter((item) => item.kind !== "file").map((item) => ({
          id: `${item.id}-gallery`,
          kind: item.kind as "video" | "audio" | "image",
          url: item.url,
          label: item.label,
        })),
        contentType: "Multi media",
        provider: "Cobalt",
      },
    };
  }

  if (data.status === "local-processing") {
    return {
      ok: false,
      status: 501,
      error: "Backend meminta pemrosesan lokal yang belum didukung DATZON. Atur FORCE_LOCAL_PROCESSING=never pada backend Cobalt.",
    };
  }

  if (data.status === "error") {
    return { ok: false, status: 502, error: errorMessage((data as CobaltErrorResponse).error?.code) };
  }

  return { ok: false, status: 502, error: "Format respons backend Cobalt tidak dikenali." };
}

export async function cobaltDownload(url: string, platform: PlatformInfo): Promise<CobaltResult> {
  const base = apiBase();
  if (!base) {
    return {
      ok: false,
      status: 503,
      error: "Backend downloader belum dikonfigurasi. Tambahkan COBALT_API_URL di Environment Variables Vercel.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "DATZON-Downloader/1.1",
    };
    const key = (process.env.COBALT_API_KEY || "").trim();
    if (key) headers.Authorization = `Api-Key ${key}`;

    const response = await fetch(`${base}/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url,
        downloadMode: "auto",
        videoQuality: "1080",
        audioFormat: "mp3",
        audioBitrate: "128",
        filenameStyle: "pretty",
        localProcessing: "disabled",
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let data: CobaltBaseResponse;
    try {
      data = JSON.parse(text) as CobaltBaseResponse;
    } catch {
      return {
        ok: false,
        status: response.status || 502,
        error: `Backend Cobalt memberi respons bukan JSON (HTTP ${response.status}).`,
      };
    }

    const normalized = normalizeCobalt(data, platform);
    if (!response.ok && normalized.ok) {
      return { ok: false, status: response.status, error: `Backend Cobalt menolak permintaan (HTTP ${response.status}).` };
    }
    return { ...normalized, status: normalized.ok ? 200 : response.status || normalized.status };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, status: 504, error: "Backend downloader terlalu lama merespons." };
    }
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? `Tidak dapat menghubungi backend Cobalt: ${error.message}` : "Tidak dapat menghubungi backend Cobalt.",
    };
  } finally {
    clearTimeout(timer);
  }
}

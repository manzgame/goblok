import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { cobaltDownload } from "@/lib/cobalt";
import { detectPlatform } from "@/lib/platforms";
import { pinterestQueryFromInput, pinterestSearch } from "@/lib/providers/pinterest";
import { spotifyDownload } from "@/lib/providers/spotify";
import { tikTokDownload } from "@/lib/providers/tiktok";
import type { DownloadApiResponse, MediaKind, NormalizedMedia, PlatformInfo } from "@/types/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIRECT_EXTENSIONS: Record<string, MediaKind> = {
  mp4: "video", webm: "video", mov: "video", m4v: "video", mkv: "video",
  mp3: "audio", m4a: "audio", aac: "audio", wav: "audio", ogg: "audio", opus: "audio", flac: "audio",
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image", avif: "image",
};

function json(payload: DownloadApiResponse, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function directMedia(url: string, platform: PlatformInfo): NormalizedMedia | null {
  try {
    const parsed = new URL(url);
    const rawName = parsed.pathname.split("/").filter(Boolean).pop() || "media";
    const filename = decodeURIComponent(rawName);
    const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined;
    if (!extension || !DIRECT_EXTENSIONS[extension]) return null;

    const kind = DIRECT_EXTENSIONS[extension];
    const cleanTitle = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Media langsung";
    const id = createHash("sha1").update(url).digest("hex").slice(0, 12);

    return {
      title: cleanTitle,
      author: parsed.hostname.replace(/^www\./, ""),
      description: "Tautan ini mengarah langsung ke berkas media, jadi tidak perlu diproses oleh layanan eksternal.",
      platform,
      preview: {
        video: kind === "video" ? url : undefined,
        audio: kind === "audio" ? url : undefined,
        image: kind === "image" ? url : undefined,
      },
      downloads: [{ id, kind, url, label: `${kind === "video" ? "Video" : kind === "audio" ? "Audio" : "Gambar"} asli`, format: extension.toUpperCase() }],
      gallery: kind === "file" ? undefined : [{ id: `${id}-preview`, kind, url, previewUrl: kind === "image" ? url : undefined, label: "Media asli" }],
      contentType: "Direct media",
      sourceUrl: url,
      provider: "Direct URL",
    };
  } catch {
    return null;
  }
}

async function processInput(input: unknown) {
  const value = typeof input === "string" ? input.trim() : "";
  const platform = detectPlatform(value);

  if (!value) return json({ success: false, input: "", platform, error: "Tempel tautan media terlebih dahulu." }, 400);
  if (value.length > 4096) return json({ success: false, input: value, platform, error: "Tautan terlalu panjang." }, 400);

  const pinterestQuery = pinterestQueryFromInput(value);
  if (!isHttpUrl(value) && !pinterestQuery) {
    return json({ success: false, input: value, platform, error: "Masukkan URL valid, atau gunakan format pinterest: kata kunci." }, 400);
  }

  if (isHttpUrl(value)) {
    const direct = directMedia(value, platform);
    if (direct) return json({ success: true, input: value, platform, media: direct });
  }

  let result;
  if (platform.id === "tiktok") {
    result = await tikTokDownload(value, platform);
    if (!result.ok) {
      const fallback = await cobaltDownload(value, platform);
      if (fallback.ok) result = fallback;
    }
  } else if (platform.id === "spotify") {
    result = await spotifyDownload(value, platform);
  } else if (platform.id === "pinterest" && pinterestQuery) {
    result = await pinterestSearch(value, platform);
  } else {
    result = await cobaltDownload(value, platform);
  }

  if (!result.ok || !result.media) {
    return json(
      { success: false, input: value, platform, error: result.error || "Media belum bisa diproses. Pastikan tautannya publik dan provider aktif." },
      result.status >= 400 && result.status <= 599 ? result.status : 502,
    );
  }

  return json({ success: true, input: value, platform, media: result.media });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return processInput(body?.url);
  } catch {
    return json({ success: false, input: "", platform: detectPlatform(""), error: "Permintaan tidak valid." }, 400);
  }
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("url");
  return processInput(value);
}

import type { NormalizedMedia, PlatformInfo } from "@/types/download";
import { fetchJson, firstString, makeDownload, makeGallery, safeString } from "./shared";
import type { ProviderResult } from "./tiktok";

type AnyRecord = Record<string, unknown>;

export interface SpotifyTrackData {
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  durationSeconds?: number;
  cover?: string;
  audio?: string;
  provider: string;
}

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function pickHttp(value: unknown, preferredKeys: string[] = []): string {
  if (!value) return "";
  if (typeof value === "string") {
    const clean = value.trim();
    return isHttpUrl(clean) ? clean : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickHttp(item, preferredKeys);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object") {
    const source = value as AnyRecord;
    const keys = [
      ...preferredKeys,
      "download_url", "downloadUrl", "audio_url", "audioUrl",
      "audio", "url", "src", "link", "file", "download",
    ];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const found = pickHttp(source[key], preferredKeys);
      if (found) return found;
    }
  }
  return "";
}

export function durationToSeconds(value?: string) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function normalizeSpotifyPayload(payload: unknown): SpotifyTrackData {
  const root = record(payload);
  const data = record(root.data ?? root);
  const title = firstString(data.title, data.name) || "Untitled Song";
  const artist = firstString(data.artist, data.artists, data.author) || "Unknown Artist";
  const album = firstString(data.album, data.album_name, data.albumName);
  const duration = firstString(data.duration, data.duration_text, data.durationText) || undefined;
  const cover = firstString(data.cover_url, data.cover, data.thumbnail, data.image, data.artwork);
  const audio = pickHttp(data, [
    "download_url", "downloadUrl", "audio_url", "audioUrl",
    "audio", "file_url", "fileUrl", "url",
  ]);
  const provider = firstString(root.author, root.creator, root.provider) || "BINTANG API";

  return {
    title,
    artist,
    album: album || undefined,
    duration,
    durationSeconds: durationToSeconds(duration),
    cover: cover || undefined,
    audio: audio || undefined,
    provider,
  };
}

export async function fetchSpotifyTrack(url: string, attempt = 0, timeoutMs = 22_000): Promise<SpotifyTrackData> {
  const endpoint = `https://bintangapi.my.id/api/downloader/spotify?url=${encodeURIComponent(url)}&_datzon=${Date.now()}-${attempt}`;
  const payload = await fetchJson(endpoint, undefined, timeoutMs) as AnyRecord;
  if (!payload.success || !payload.data) {
    throw new Error(safeString(payload.error) || "API Spotify tidak mengembalikan data lagu.");
  }
  const track = normalizeSpotifyPayload(payload);
  if (!track.audio) throw new Error("Data lagu ditemukan, tetapi URL audionya kosong.");
  return track;
}

export async function fetchSpotifyCandidates(url: string, attempts = 4) {
  const tracks: SpotifyTrackData[] = [];
  const seen = new Set<string>();
  let lastError = "";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const track = await fetchSpotifyTrack(url, attempt);
      if (track.audio && !seen.has(track.audio)) {
        seen.add(track.audio);
        tracks.push(track);
      } else if (!tracks.length) {
        tracks.push(track);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Spotify gagal diproses.";
    }
  }

  if (!tracks.length) throw new Error(lastError || "Provider Spotify tidak memberi kandidat audio.");
  return tracks;
}

function spotifyAudioRoute(sourceUrl: string) {
  const params = new URLSearchParams({ source: sourceUrl });
  return `/api/spotify/audio?${params.toString()}`;
}

function normalizeSpotify(track: SpotifyTrackData, sourceUrl: string, platform: PlatformInfo): NormalizedMedia {
  const audioRoute = spotifyAudioRoute(sourceUrl);
  return {
    title: track.title,
    author: track.artist,
    album: track.album,
    description: track.album ? `${track.artist} • ${track.album}` : track.artist,
    thumbnail: track.cover,
    duration: track.duration,
    platform,
    preview: { audio: audioRoute },
    downloads: [
      makeDownload({
        url: audioRoute,
        kind: "audio",
        label: "Audio MP3",
        quality: "Original",
        format: "MP3",
        thumbnail: track.cover,
      }),
    ],
    gallery: [
      makeGallery({
        url: audioRoute,
        kind: "audio",
        previewUrl: track.cover,
        label: "Audio Spotify",
      }),
    ],
    creator: { name: track.artist },
    contentType: "Musik",
    sourceUrl,
    provider: `${track.provider} + pemeriksaan durasi`,
  };
}

export async function spotifyDownload(url: string, platform: PlatformInfo): Promise<ProviderResult> {
  try {
    const track = await fetchSpotifyTrack(url);
    return { ok: true, status: 200, media: normalizeSpotify(track, url, platform) };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.name === "AbortError" ? 504 : 502,
      error: error instanceof Error ? `Spotify gagal diproses: ${error.message}` : "Spotify gagal diproses.",
    };
  }
}

import { createHash } from "crypto";
import type { MediaDownload, MediaKind, NormalizedMedia, PlatformInfo } from "@/types/download";

const TITLE_KEYS = ["title", "name", "track_name", "video_title", "caption", "filename"];
const AUTHOR_KEYS = ["author", "artist", "uploader", "channel", "owner", "username", "nickname"];
const DESCRIPTION_KEYS = ["description", "desc", "text", "caption"];
const DURATION_KEYS = ["duration", "duration_ms", "length", "seconds"];
const THUMBNAIL_KEYS = ["thumbnail", "thumb", "cover", "cover_url", "artwork", "image", "poster"];

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "mkv"];
const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "opus", "flac"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[\s-]+/g, "_");
}

function findFirstByKeys(source: unknown, keys: string[], depth = 0): unknown {
  if (depth > 7 || source === null || source === undefined) return undefined;

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findFirstByKeys(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (!isRecord(source)) return undefined;

  for (const [key, value] of Object.entries(source)) {
    if (keys.includes(normalizeKey(key)) && value !== null && value !== "") return value;
  }

  for (const value of Object.values(source)) {
    const found = findFirstByKeys(value, keys, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function stringifyMetadata(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isRecord(value)) {
    for (const key of ["name", "title", "username", "nickname", "artist"]) {
      const nested = value[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return undefined;
}

function formatDuration(value: unknown): string | undefined {
  if (typeof value === "string") {
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value.trim())) return value.trim();
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return value.trim() || undefined;
    value = parsed;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  let seconds = value > 100000 ? Math.round(value / 1000) : Math.round(value);
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function extensionFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() || "";
    const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined;
    return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : undefined;
  } catch {
    return undefined;
  }
}

function classifyUrl(url: string, path: string): MediaKind {
  const extension = extensionFromUrl(url);
  const haystack = `${path} ${url}`.toLowerCase();

  if ((extension && VIDEO_EXTENSIONS.includes(extension)) || /\b(video|play|nowm|no_watermark|without_watermark|hdplay|wmplay)\b/.test(haystack)) return "video";
  if ((extension && AUDIO_EXTENSIONS.includes(extension)) || /\b(audio|music|sound|song|track|mp3)\b/.test(haystack)) return "audio";
  if ((extension && IMAGE_EXTENSIONS.includes(extension)) || /\b(image|photo|picture|slide|thumbnail|thumb|cover|artwork|poster)\b/.test(haystack)) return "image";
  return "file";
}

function prettifyLabel(path: string, kind: MediaKind, index: number) {
  const raw = path
    .split(".")
    .filter((part) => part && !/^\d+$/.test(part))
    .slice(-3)
    .join(" ")
    .replace(/[_-]+/g, " ")
    .replace(/\b(url|link|src|download|data|result|media|medias|formats?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (raw) return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${kind === "file" ? "Media" : kind[0].toUpperCase() + kind.slice(1)} ${index + 1}`;
}

function inferQuality(path: string, sibling: Record<string, unknown>) {
  const siblingQuality = ["quality", "resolution", "label", "format_note", "bitrate"]
    .map((key) => sibling[key])
    .find((value) => typeof value === "string" || typeof value === "number");
  if (siblingQuality !== undefined) return String(siblingQuality);

  const match = path.match(/(?:^|[^0-9])(2160p|1440p|1080p|720p|480p|360p|240p|8k|4k|2k|hd|sd)(?:[^a-z0-9]|$)/i);
  return match?.[1]?.toUpperCase();
}

function inferSize(sibling: Record<string, unknown>) {
  const value = ["size", "filesize", "file_size", "content_length"]
    .map((key) => sibling[key])
    .find((entry) => typeof entry === "string" || typeof entry === "number");

  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isLikelyNonMedia(path: string, url: string) {
  const value = `${path} ${url}`.toLowerCase();
  return /\b(profile|avatar|author_url|webpage|canonical|source_url|share_url|original_url|input)\b/.test(value);
}

interface CollectedUrl {
  url: string;
  path: string;
  sibling: Record<string, unknown>;
}

function collectUrls(source: unknown) {
  const collected: CollectedUrl[] = [];
  const visited = new WeakSet<object>();

  function walk(value: unknown, path: string, sibling: Record<string, unknown>, depth: number) {
    if (depth > 9 || value === null || value === undefined) return;

    if (isHttpUrl(value)) {
      collected.push({ url: value, path, sibling });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}.${index}`, sibling, depth + 1));
      return;
    }

    if (!isRecord(value)) return;
    if (visited.has(value)) return;
    visited.add(value);

    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${normalizeKey(key)}` : normalizeKey(key), value, depth + 1);
    }
  }

  walk(source, "", {}, 0);
  return collected;
}

function scoreThumbnail(candidate: CollectedUrl) {
  const text = candidate.path.toLowerCase();
  let score = 0;
  if (/thumbnail|thumb/.test(text)) score += 10;
  if (/cover|artwork|poster/.test(text)) score += 8;
  if (/image|photo/.test(text)) score += 4;
  if (classifyUrl(candidate.url, candidate.path) === "image") score += 3;
  if (/avatar|profile/.test(text)) score -= 8;
  return score;
}

function deduplicateDownloads(downloads: MediaDownload[]) {
  const seen = new Set<string>();
  return downloads.filter((download) => {
    const key = download.url.replace(/&amp;/g, "&");
    if (seen.has(key)) return false;
    seen.add(key);
    download.url = key;
    return true;
  });
}

export function normalizeMediaResult(raw: unknown, platform: PlatformInfo): NormalizedMedia {
  const root = isRecord(raw) && raw.Result !== undefined ? raw.Result : raw;
  const urls = collectUrls(root);

  const title = stringifyMetadata(findFirstByKeys(root, TITLE_KEYS)) || `${platform.name} media`;
  const author = stringifyMetadata(findFirstByKeys(root, AUTHOR_KEYS));
  const description = stringifyMetadata(findFirstByKeys(root, DESCRIPTION_KEYS));
  const duration = formatDuration(findFirstByKeys(root, DURATION_KEYS));

  const thumbnailValue = findFirstByKeys(root, THUMBNAIL_KEYS);
  const explicitThumbnail = isHttpUrl(thumbnailValue) ? thumbnailValue : undefined;
  const fallbackThumbnail = [...urls].sort((a, b) => scoreThumbnail(b) - scoreThumbnail(a))[0]?.url;
  const thumbnail = explicitThumbnail || fallbackThumbnail;

  const candidates = urls.filter(({ url, path }) => {
    if (isLikelyNonMedia(path, url)) return false;
    const kind = classifyUrl(url, path);
    if (kind !== "file") return true;
    return /download|media|format|video|audio|music|file|url|link|src/.test(path.toLowerCase());
  });

  const downloads = deduplicateDownloads(
    candidates.map((candidate, index) => {
      const kind = classifyUrl(candidate.url, candidate.path);
      const format = extensionFromUrl(candidate.url)?.toUpperCase();
      return {
        id: createHash("sha1").update(`${candidate.url}-${index}`).digest("hex").slice(0, 12),
        kind,
        url: candidate.url,
        label: prettifyLabel(candidate.path, kind, index),
        quality: inferQuality(candidate.path, candidate.sibling),
        format,
        size: inferSize(candidate.sibling),
      } satisfies MediaDownload;
    }),
  ).sort((a, b) => {
    const order: Record<MediaKind, number> = { video: 0, audio: 1, image: 2, file: 3 };
    return order[a.kind] - order[b.kind];
  });

  const firstVideo = downloads.find((item) => item.kind === "video")?.url;
  const firstAudio = downloads.find((item) => item.kind === "audio")?.url;
  const firstImage = downloads.find((item) => item.kind === "image")?.url || thumbnail;

  return {
    title,
    author,
    description: description && description !== title ? description : undefined,
    thumbnail,
    duration,
    platform,
    preview: {
      video: firstVideo,
      audio: firstAudio,
      image: firstImage,
    },
    downloads,
  };
}

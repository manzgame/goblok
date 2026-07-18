import { createHash } from "crypto";
import type { MediaDownload, MediaGalleryItem, MediaKind } from "@/types/download";

export function hashId(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

export function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = safeString(value);
    if (text) return text;
  }
  return "";
}

export function formatDuration(value: unknown) {
  if (typeof value === "string" && value.includes(":")) return value;
  const seconds = Math.max(0, safeNumber(value));
  if (!seconds) return undefined;
  const minutes = Math.floor(seconds / 60);
  const remain = Math.floor(seconds % 60);
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function formatUnixDate(value: unknown) {
  const numeric = safeNumber(value);
  if (!numeric) return undefined;
  const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(milliseconds));
  } catch {
    return undefined;
  }
}

export function inferExtension(url: string, fallback?: string) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return (match?.[1] || fallback || "").toUpperCase() || undefined;
  } catch {
    return fallback?.toUpperCase();
  }
}

export function makeDownload(args: {
  url: string;
  kind: MediaKind;
  label: string;
  quality?: string;
  format?: string;
  thumbnail?: string;
}): MediaDownload {
  return {
    id: hashId(`${args.url}:${args.label}`),
    kind: args.kind,
    url: args.url,
    label: args.label,
    quality: args.quality,
    format: args.format || inferExtension(args.url),
    thumbnail: args.thumbnail,
  };
}

export function makeGallery(args: {
  url: string;
  kind: "video" | "audio" | "image";
  label: string;
  previewUrl?: string;
  isLive?: boolean;
}): MediaGalleryItem {
  return {
    id: hashId(`${args.url}:${args.label}:gallery`),
    kind: args.kind,
    url: args.url,
    previewUrl: args.previewUrl,
    label: args.label,
    isLive: args.isLive,
  };
}

export async function fetchJson(url: string, init?: RequestInit, timeoutMs = 35_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": "DATZON-Downloader/2.0",
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Provider memberi respons bukan JSON (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(`Provider menolak permintaan (HTTP ${response.status}).`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

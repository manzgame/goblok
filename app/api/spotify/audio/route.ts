import { Buffer } from "node:buffer";
import { parseBuffer } from "music-metadata";
import { fetchSpotifyTrack, type SpotifyTrackData } from "@/lib/providers/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 45 * 1024 * 1024;
const MAX_COVER_BYTES = 6 * 1024 * 1024;

function jsonError(message: string, status = 502) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n"\\/]/g, " ")
    .replace(/[^a-z0-9._ -]+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 120) || "Spotify Audio";
}

function assertSpotifyUrl(value: string) {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  const allowed = host === "open.spotify.com" || host === "spotify.link" || host.endsWith(".spotify.com");
  if (parsed.protocol !== "https:" || !allowed) throw new Error("Tautan Spotify tidak valid.");
  return parsed.toString();
}

function normalizeWords(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function overlapScore(expected: string, actual: string) {
  const expectedWords = normalizeWords(expected);
  const actualSet = new Set(normalizeWords(actual));
  if (!expectedWords.length || !actualSet.size) return 1;
  const matched = expectedWords.filter((word) => actualSet.has(word)).length;
  return matched / expectedWords.length;
}

function durationMatches(actual: number, expected: number) {
  if (!expected || expected < 20 || !actual || !Number.isFinite(actual)) return true;
  return actual >= expected * 0.9 && actual <= expected * 1.12;
}

async function fetchBuffer(url: string, maxBytes: number, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 (compatible; DATZON-Downloader/4.0)",
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider audio menolak permintaan (HTTP ${response.status}).`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared && declared > maxBytes) throw new Error("Ukuran media terlalu besar untuk diproses.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) throw new Error("Berkas media kosong atau terlalu besar.");
    return {
      buffer,
      contentType: response.headers.get("content-type") || "application/octet-stream",
    };
  } finally {
    clearTimeout(timer);
  }
}

function syncSafe(value: number) {
  const output = Buffer.alloc(4);
  output[0] = (value >> 21) & 0x7f;
  output[1] = (value >> 14) & 0x7f;
  output[2] = (value >> 7) & 0x7f;
  output[3] = value & 0x7f;
  return output;
}

function frame(id: string, data: Buffer) {
  const header = Buffer.alloc(10);
  header.write(id, 0, 4, "ascii");
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}

function textFrame(id: string, value?: string) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  return frame(id, Buffer.concat([Buffer.from([0x03]), Buffer.from(clean, "utf8")]));
}

function imageFrame(buffer: Buffer, mimeType: string) {
  const mime = /^image\/[a-z0-9.+-]+$/i.test(mimeType) ? mimeType : "image/jpeg";
  const body = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from(mime, "ascii"),
    Buffer.from([0x00, 0x03, 0x00]),
    buffer,
  ]);
  return frame("APIC", body);
}

function stripLeadingId3(audio: Buffer) {
  if (audio.length < 10 || audio.subarray(0, 3).toString("ascii") !== "ID3") return audio;
  const size =
    ((audio[6] & 0x7f) << 21) |
    ((audio[7] & 0x7f) << 14) |
    ((audio[8] & 0x7f) << 7) |
    (audio[9] & 0x7f);
  const offset = Math.min(audio.length, 10 + size);
  return audio.subarray(offset);
}

async function addMetadata(audio: Buffer, track: SpotifyTrackData) {
  const frames: Buffer[] = [];
  for (const item of [
    textFrame("TIT2", track.title),
    textFrame("TPE1", track.artist),
    textFrame("TALB", track.album),
  ]) {
    if (item) frames.push(item);
  }

  if (track.cover) {
    try {
      const cover = await fetchBuffer(track.cover, MAX_COVER_BYTES, 18_000);
      if (cover.contentType.startsWith("image/")) frames.push(imageFrame(cover.buffer, cover.contentType));
    } catch {
      // Cover gagal tidak boleh menggagalkan audio. Hidup sudah cukup dramatis tanpa itu.
    }
  }

  if (!frames.length) return audio;
  const body = Buffer.concat(frames);
  const header = Buffer.concat([
    Buffer.from("ID3", "ascii"),
    Buffer.from([0x03, 0x00, 0x00]),
    syncSafe(body.length),
  ]);
  return Buffer.concat([header, body, stripLeadingId3(audio)]);
}

async function resolveValidatedAudio(source: string) {
  const failures: string[] = [];
  const seen = new Set<string>();
  const startedAt = Date.now();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (Date.now() - startedAt > 52_000) break;

    let track: SpotifyTrackData;
    try {
      track = await fetchSpotifyTrack(source, attempt, 16_000);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "metadata Spotify gagal");
      continue;
    }

    if (!track.audio || seen.has(track.audio)) {
      if (track.audio) seen.add(track.audio);
      continue;
    }
    seen.add(track.audio);

    try {
      const remaining = Math.max(12_000, 50_000 - (Date.now() - startedAt));
      const fetched = await fetchBuffer(track.audio, MAX_AUDIO_BYTES, Math.min(30_000, remaining));
      const metadata = await parseBuffer(
        fetched.buffer,
        { mimeType: fetched.contentType, size: fetched.buffer.length },
        { duration: true, skipCovers: true },
      );
      const actualDuration = Number(metadata.format.duration || 0);
      const titleTag = String(metadata.common.title || "");
      const artistTag = Array.isArray(metadata.common.artists)
        ? metadata.common.artists.join(" ")
        : String(metadata.common.artist || "");

      if (!durationMatches(actualDuration, track.durationSeconds || 0)) {
        failures.push(`durasi ${Math.round(actualDuration)} detik tidak cocok`);
        continue;
      }
      if (titleTag && overlapScore(track.title, titleTag) < 0.45) {
        failures.push("judul audio tidak cocok");
        continue;
      }
      if (artistTag && overlapScore(track.artist, artistTag) < 0.34) {
        failures.push("artis audio tidak cocok");
        continue;
      }

      return { track, buffer: fetched.buffer, contentType: fetched.contentType, actualDuration };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "kandidat audio gagal");
    }
  }

  const detail = failures.filter(Boolean).slice(-2).join("; ");
  throw new Error(
    detail
      ? `Provider belum memberi lagu penuh yang cocok (${detail}). Coba proses ulang beberapa saat lagi.`
      : "Provider belum memberi lagu penuh yang cocok. Coba proses ulang beberapa saat lagi.",
  );
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const source = assertSpotifyUrl(requestUrl.searchParams.get("source")?.trim() || "");
    const download = requestUrl.searchParams.get("download") === "1";
    const resolved = await resolveValidatedAudio(source);
    const output = download ? await addMetadata(resolved.buffer, resolved.track) : resolved.buffer;
    const requestedName = requestUrl.searchParams.get("filename") || `${resolved.track.title}.mp3`;
    const filename = safeFilename(requestedName.toLowerCase().endsWith(".mp3") ? requestedName : `${requestedName}.mp3`);

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(output.length),
        "Accept-Ranges": "none",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-DATZON-Audio-Duration": resolved.actualDuration ? String(Math.round(resolved.actualDuration)) : "unknown",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio Spotify gagal diproses.";
    return jsonError(message, /tidak valid/i.test(message) ? 400 : 422);
  }
}

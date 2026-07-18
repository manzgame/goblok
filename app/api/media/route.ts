import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_REDIRECTS = 5;

function safeFilename(value: string) {
  return value
    .replace(/[\r\n"\\/]/g, "-")
    .replace(/[^a-z0-9._ -]+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 120) || "datzon media";
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  return (
    normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

async function assertPublicUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Protokol media tidak didukung.");
  if (parsed.username || parsed.password) throw new Error("URL media tidak valid.");
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") throw new Error("Port media tidak diizinkan.");

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Host media tidak diizinkan.");
  }

  if (isIP(hostname)) {
    if ((isIP(hostname) === 4 && isPrivateIpv4(hostname)) || (isIP(hostname) === 6 && isPrivateIpv6(hostname))) {
      throw new Error("Alamat jaringan privat tidak diizinkan.");
    }
    return parsed;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Host media tidak ditemukan.");
  for (const item of addresses) {
    if ((item.family === 4 && isPrivateIpv4(item.address)) || (item.family === 6 && isPrivateIpv6(item.address))) {
      throw new Error("Host media mengarah ke jaringan privat.");
    }
  }
  return parsed;
}

async function fetchRemote(url: string, range: string | null, depth = 0): Promise<Response> {
  if (depth > MAX_REDIRECTS) throw new Error("Terlalu banyak pengalihan media.");
  const parsed = await assertPublicUrl(url);
  const headers: HeadersInit = {
    Accept: "*/*",
    "User-Agent": "Mozilla/5.0 (compatible; DATZON-Downloader/3.0)",
    Referer: `${parsed.protocol}//${parsed.hostname}/`,
  };
  if (range) headers.Range = range;

  const response = await fetch(parsed, {
    method: "GET",
    headers,
    cache: "no-store",
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Provider mengalihkan media tanpa alamat tujuan.");
    return fetchRemote(new URL(location, parsed).toString(), range, depth + 1);
  }
  return response;
}

function inferFilename(url: string, contentType: string | null) {
  try {
    const pathname = new URL(url).pathname;
    const candidate = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
    if (candidate && candidate.includes(".")) return safeFilename(candidate);
  } catch {}
  const extension = contentType?.includes("video") ? "mp4" : contentType?.includes("audio") ? "mp3" : contentType?.includes("image") ? "jpg" : "bin";
  return `datzon-media.${extension}`;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const remoteUrl = requestUrl.searchParams.get("url")?.trim() || "";
    if (!remoteUrl || remoteUrl.length > 8192) return Response.json({ error: "URL media tidak valid." }, { status: 400 });

    const range = request.headers.get("range");
    const remote = await fetchRemote(remoteUrl, range);
    if (!remote.ok && remote.status !== 206) {
      return Response.json({ error: `Media gagal dimuat (HTTP ${remote.status}).` }, { status: remote.status >= 400 ? remote.status : 502 });
    }

    const contentType = remote.headers.get("content-type") || "application/octet-stream";
    const requestedFilename = requestUrl.searchParams.get("filename") || "";
    const filename = safeFilename(requestedFilename || inferFilename(remoteUrl, contentType));
    const download = requestUrl.searchParams.get("download") === "1";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Accept-Ranges", remote.headers.get("accept-ranges") || "bytes");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = remote.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(remote.body, { status: remote.status, headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Media gagal diproksi." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

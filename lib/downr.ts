import axios from "axios";
import http from "http";
import https from "https";

const CACHE_TTL_MS = 8 * 60 * 1000;
const MAX_CACHE_ENTRIES = 150;

function getProviderBases() {
  const configured = (process.env.DOWNR_BASE_URLS || process.env.DOWNR_BASE_URL || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return Array.from(new Set([...configured, "https://downr.org", "https://downr.net"]));
}

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 20 });

const apiClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 22_000,
  maxContentLength: 12 * 1024 * 1024,
  maxBodyLength: 12 * 1024 * 1024,
});

interface CacheEntry {
  data: DownrResponse;
  expiresAt: number;
}

interface ProviderResult {
  endpoint: string;
  status: number;
  data: unknown;
}

export interface DownrResponse {
  Status: boolean;
  Code: number;
  Input: string;
  Endpoint: string | null;
  Result: unknown;
  Error: string | null;
}

const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<DownrResponse>>();

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= now) cache.delete(key);
  }

  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function validateInputUrl(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Tautan harus memakai HTTP atau HTTPS.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Alamat lokal tidak didukung.");
  }

  return parsed.toString();
}

function parseCookie(setCookie: string[] = []) {
  return setCookie.map((value) => value.split(";")[0]).join("; ");
}

function parseData(data: unknown) {
  if (typeof data !== "string") return data;
  const text = data.trim();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isSuccessful(status: number, data: unknown) {
  if (status < 200 || status >= 300 || data === null || data === undefined || data === "") return false;
  if (typeof data === "string") {
    return !["error", "failed", "user_retry_required"].includes(data.toLowerCase());
  }
  if (typeof data === "object") {
    const object = data as Record<string, unknown>;
    if (object.error === true || object.status === false || object.success === false) return false;
  }
  return true;
}

function getError(data: unknown, status: number) {
  if (typeof data === "string") return data || `HTTP ${status}`;
  if (data && typeof data === "object") {
    const object = data as Record<string, unknown>;
    const message = object.message ?? object.error ?? object.reason;
    if (typeof message === "string") return message;
  }
  return `Layanan sumber mengembalikan HTTP ${status}.`;
}

function headers(base: string, cookie = "") {
  return {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    cookie,
    origin: base,
    referer: `${base}/`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  };
}

async function getCookie(base: string) {
  try {
    const response = await apiClient.get(`${base}/.netlify/functions/analytics`, {
      headers: headers(base),
      timeout: 8_000,
      validateStatus: () => true,
    });
    return parseCookie((response.headers["set-cookie"] as string[] | undefined) || []);
  } catch {
    return "";
  }
}

async function postEndpoint(base: string, endpointName: "download" | "nyt", url: string, cookie: string): Promise<ProviderResult> {
  const endpoint = `${base}/.netlify/functions/${endpointName}`;
  try {
    const response = await apiClient.post(endpoint, { url }, {
      headers: headers(base, cookie),
      responseType: "text",
      transformResponse: [(value) => value],
      validateStatus: () => true,
    });

    return {
      endpoint,
      status: response.status,
      data: parseData(response.data),
    };
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 502;
    return { endpoint, status, data: null };
  }
}

async function fetchFromBase(base: string, url: string) {
  const cookie = await getCookie(base);
  const primary = await postEndpoint(base, "download", url, cookie);
  if (isSuccessful(primary.status, primary.data)) return primary;

  const fallback = await postEndpoint(base, "nyt", url, cookie);
  return isSuccessful(fallback.status, fallback.data) ? fallback : primary.status !== 502 ? primary : fallback;
}

async function fetchFromSource(url: string) {
  let lastResult: ProviderResult = {
    endpoint: `${getProviderBases()[0]}/.netlify/functions/download`,
    status: 502,
    data: null,
  };

  for (const base of getProviderBases()) {
    const result = await fetchFromBase(base, url);
    if (isSuccessful(result.status, result.data)) return result;
    lastResult = result;
  }

  return lastResult;
}

export async function downr(input: string): Promise<DownrResponse> {
  let url = input;
  try {
    url = validateInputUrl(input.trim());
    cleanCache();

    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const pending = pendingRequests.get(url);
    if (pending) return pending;

    const request = (async () => {
      const result = await fetchFromSource(url);
      const ok = isSuccessful(result.status, result.data);
      const response: DownrResponse = {
        Status: ok,
        Code: result.status,
        Input: url,
        Endpoint: result.endpoint,
        Result: ok ? result.data : null,
        Error: ok ? null : getError(result.data, result.status),
      };

      if (ok) cache.set(url, { data: response, expiresAt: Date.now() + CACHE_TTL_MS });
      return response;
    })();

    pendingRequests.set(url, request);
    return await request;
  } catch (error: unknown) {
    return {
      Status: false,
      Code: 400,
      Input: url,
      Endpoint: null,
      Result: null,
      Error: error instanceof Error ? error.message : "Tautan tidak valid.",
    };
  } finally {
    pendingRequests.delete(url);
  }
}

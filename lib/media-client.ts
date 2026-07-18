export function sanitizeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._ -]+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 110) || "datzon media";
}

interface ProxyMediaOptions {
  download?: boolean;
  filename?: string;
  cover?: string;
  title?: string;
  artist?: string;
  expectedDuration?: string;
}

export function proxyMediaUrl(url?: string, options?: ProxyMediaOptions) {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const applyOptions = (target: string) => {
    const [base, hash = ""] = target.split("#", 2);
    const separator = base.includes("?") ? "&" : "?";
    const params = new URLSearchParams();
    if (options?.download) params.set("download", "1");
    if (options?.filename) params.set("filename", sanitizeFilename(options.filename));
    if (options?.cover) params.set("cover", options.cover);
    if (options?.title) params.set("title", options.title);
    if (options?.artist) params.set("artist", options.artist);
    if (options?.expectedDuration) params.set("expected", options.expectedDuration);
    const query = params.toString();
    return `${base}${query ? `${separator}${query}` : ""}${hash ? `#${hash}` : ""}`;
  };

  if (url.startsWith("/api/")) return applyOptions(url);

  const params = new URLSearchParams({ url });
  if (options?.download) params.set("download", "1");
  if (options?.filename) params.set("filename", sanitizeFilename(options.filename));
  if (options?.cover) params.set("cover", options.cover);
  if (options?.title) params.set("title", options.title);
  if (options?.artist) params.set("artist", options.artist);
  if (options?.expectedDuration) params.set("expected", options.expectedDuration);
  return `/api/media?${params.toString()}`;
}

export function filenameForMedia(title: string, label: string, format?: string) {
  const extension = (format || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = sanitizeFilename(label ? `${title} ${label}` : title);
  return extension && !base.toLowerCase().endsWith(`.${extension}`) ? `${base}.${extension}` : base;
}

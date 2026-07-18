import type { NormalizedMedia, PlatformInfo } from "@/types/download";
import { fetchJson, firstString, formatUnixDate, makeDownload, makeGallery, safeNumber, safeString } from "./shared";
import type { ProviderResult } from "./tiktok";

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

export function pinterestQueryFromInput(input: string) {
  const prefix = input.match(/^pinterest\s*:\s*(.+)$/i);
  if (prefix?.[1]?.trim()) return prefix[1].trim();
  try {
    const parsed = new URL(input);
    const query = parsed.searchParams.get("q") || parsed.searchParams.get("query");
    if (query?.trim()) return query.trim();
  } catch {
    return "";
  }
  return "";
}

export async function pinterestSearch(input: string, platform: PlatformInfo): Promise<ProviderResult> {
  const query = pinterestQueryFromInput(input);
  if (!query) return { ok: false, status: 400, error: "Tautan Pinterest ini bukan halaman pencarian. Gunakan pin langsung atau ketik pinterest: kata kunci." };

  try {
    const payload = await fetchJson(`https://bintangapi.my.id/api/search/pinterest?q=${encodeURIComponent(query)}`) as AnyRecord;
    const raw = Array.isArray(payload.data) ? payload.data : [];
    if (!payload.success || !raw.length) {
      return { ok: false, status: 404, error: safeString(payload.error) || `Tidak ada hasil Pinterest untuk “${query}”.` };
    }

    const pins = raw.slice(0, 18).map((entry, index) => {
      const pin = record(entry);
      const pinner = record(pin.pinner);
      const image = firstString(pin.image, pin.thumbnail);
      return {
        title: firstString(pin.title) || `Pinterest ${index + 1}`,
        description: firstString(pin.description),
        image,
        source: firstString(pin.url, pin.board_url) || "https://www.pinterest.com/",
        pinnerName: firstString(pinner.name, pinner.username),
        likes: safeNumber(pin.likes),
        createdAt: firstString(pin.created_at) || formatUnixDate(pin.created_at),
      };
    }).filter((pin) => pin.image);

    if (!pins.length) return { ok: false, status: 422, error: "API Pinterest merespons, tetapi tidak mengirim gambar yang dapat ditampilkan." };

    const downloads = pins.map((pin, index) => makeDownload({
      url: pin.image,
      kind: "image",
      label: pin.title || `Gambar ${index + 1}`,
      quality: "Original",
      format: "JPG",
      thumbnail: pin.image,
    }));
    const gallery = pins.map((pin, index) => makeGallery({
      url: pin.image,
      kind: "image",
      previewUrl: pin.image,
      label: pin.title || `Gambar ${index + 1}`,
    }));
    const first = pins[0];

    return {
      ok: true,
      status: 200,
      media: {
        title: `Hasil Pinterest: ${query}`,
        author: first.pinnerName || "Pinterest",
        description: first.description || `Ditemukan ${pins.length} gambar Pinterest untuk “${query}”.`,
        thumbnail: first.image,
        platform,
        preview: { image: first.image },
        downloads,
        gallery,
        creator: first.pinnerName ? { name: first.pinnerName } : undefined,
        stats: first.likes ? { likes: first.likes } : undefined,
        contentType: "Pinterest Search",
        publishedAt: first.createdAt || undefined,
        sourceUrl: input,
        provider: "BINTANG Pinterest",
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.name === "AbortError" ? 504 : 502,
      error: error instanceof Error ? `Pinterest gagal diproses: ${error.message}` : "Pinterest gagal diproses.",
    };
  }
}

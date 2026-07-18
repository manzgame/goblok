import type { NormalizedMedia, PlatformInfo, TikTokProfile } from "@/types/download";
import {
  fetchJson,
  firstString,
  formatDuration,
  formatUnixDate,
  hashId,
  makeDownload,
  makeGallery,
  safeNumber,
  safeString,
} from "./shared";

type AnyRecord = Record<string, unknown>;

interface TikWmResponse {
  code?: number;
  msg?: string;
  data?: AnyRecord;
}

export interface ProviderResult {
  ok: boolean;
  status: number;
  media?: NormalizedMedia;
  error?: string;
}

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickMediaUrl(value: unknown, preferredKeys: string[] = []): string {
  if (!value) return "";
  if (typeof value === "string") {
    const text = value.trim();
    return /^https?:\/\//i.test(text) || text.startsWith("data:") ? text : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickMediaUrl(item, preferredKeys);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object") {
    const source = value as AnyRecord;
    const keys = [
      ...preferredKeys,
      "url_list", "urlList", "urls", "url", "uri", "src", "href",
      "play_addr", "playAddr", "download_addr", "downloadAddr",
    ];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const found = pickMediaUrl(source[key], preferredKeys);
        if (found) return found;
      }
    }
  }
  return "";
}

function imageItems(data: AnyRecord) {
  const imagePostInfo = record(data.image_post_info);
  const imagePost = record(data.imagePost);
  const photo = record(data.photo);
  const photoData = record(data.photo_data);
  const candidates = [imagePostInfo.images, imagePost.images, photo.images, photoData.images, data.images];
  return candidates.map(array).find((items) => items.length > 0) || [];
}

function liveItems(data: AnyRecord) {
  const imagePostInfo = record(data.image_post_info);
  const imagePost = record(data.imagePost);
  const photo = record(data.photo);
  const photoData = record(data.photo_data);
  const candidates = [
    data.live_images, data.liveImages, data.live_photo_images, data.livePhotoImages,
    data.photo_live_images, data.photoLiveImages, imagePostInfo.live_images,
    imagePost.live_images, photo.live_images, photoData.live_images,
  ];
  return candidates.map(array).find((items) => items.length > 0) || [];
}

function isAudioUrl(url: string) {
  const text = url.toLowerCase();
  return /mime_type=audio|audio_mp4|audio_mpeg|ies-music|music\.tiktok|\/music\//.test(text);
}

function isImageUrl(url: string) {
  const text = url.toLowerCase();
  return /mime_type=image|image_(jpe?g|webp|png)|photomode-image|image-cover|\.(jpe?g|png|webp|gif)(\?|#|$)/.test(text);
}

function isVideoUrl(url: string) {
  const text = url.toLowerCase();
  if (!text || isAudioUrl(text) || isImageUrl(text)) return false;
  return /mime_type=video|video_mp4|\/video\/|\.mp4(\?|#|$)|_mp4(\?|#|$)|format=mp4|type=video/.test(text);
}

function extractImage(item: unknown) {
  return pickMediaUrl(item, [
    "image", "image_url", "imageUrl", "display_image", "displayImage",
    "owner_watermark_image", "ownerWatermarkImage", "thumbnail", "thumb", "cover",
    "origin_cover", "originCover", "dynamic_cover", "dynamicCover", "poster", "preview",
  ]);
}

function extractVideo(item: unknown) {
  const found = pickMediaUrl(item, [
    "video", "video_url", "videoUrl", "play", "play_url", "playUrl", "hdplay", "wmplay",
    "motion", "motion_url", "motionUrl", "livePhoto", "live_photo", "livePhotoUrl",
    "live_photo_url", "photo_movie", "photoMovie", "animated", "animated_url",
    "animatedUrl", "download_url", "downloadUrl",
  ]);
  return found && isVideoUrl(found) ? found : "";
}

function hasLiveHint(data: AnyRecord, lives: unknown[]) {
  if (lives.length) return true;
  const hashtags = array(data.hashtags).map((tag) => {
    const item = record(tag);
    return typeof tag === "string" ? tag : firstString(item.name, item.title);
  });
  const probe = [
    data.title, data.desc, data.caption, data.type, data.content_type, data.contentType,
    data.media_type, data.mediaType, data.aweme_type, data.awemeType,
    data.is_live_photo ? "is_live_photo" : "", data.isLivePhoto ? "isLivePhoto" : "",
    ...hashtags,
  ].map(safeString).join(" ").toLowerCase();
  return /foto\s*live|fotolive|live\s*photo|livephotos|live_photo|photo\s*live/.test(probe);
}

function uniqueByUrl<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function normalizeTikTok(data: AnyRecord, originalUrl: string, platform: PlatformInfo): NormalizedMedia {
  const author = record(data.author);
  const images = imageItems(data);
  const lives = liveItems(data);
  const liveHint = hasLiveHint(data, lives);

  const possibleVideo = pickMediaUrl([
    data.hdplay, data.play, data.video, data.video_url, data.videoUrl,
    data.wmplay, data.play_addr, data.download_addr,
  ], ["play_addr", "playAddr", "download_addr", "downloadAddr", "url_list", "urlList", "url"]);
  const normalVideo = isVideoUrl(possibleVideo) ? possibleVideo : "";

  const musicInfo = record(data.music_info);
  const music = pickMediaUrl([
    data.music, musicInfo.play, musicInfo.play_url, musicInfo.url,
    isAudioUrl(possibleVideo) ? possibleVideo : "",
  ]);

  const gallery = images.map((item, index) => {
    const image = extractImage(item);
    const inlineVideo = extractVideo(item);
    return inlineVideo
      ? makeGallery({ url: inlineVideo, kind: "video", previewUrl: image || undefined, label: `Foto Live ${index + 1}`, isLive: true })
      : image
        ? makeGallery({ url: image, kind: "image", previewUrl: image, label: `Foto ${index + 1}` })
        : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  for (const [index, item] of lives.entries()) {
    const video = extractVideo(item);
    if (!video) continue;
    const preview = extractImage(item) || gallery[index]?.previewUrl;
    if (gallery[index] && gallery[index].kind === "image") {
      gallery[index] = makeGallery({ url: video, kind: "video", previewUrl: preview, label: `Foto Live ${index + 1}`, isLive: true });
    } else if (!gallery.some((entry) => entry.url === video)) {
      gallery.push(makeGallery({ url: video, kind: "video", previewUrl: preview, label: `Foto Live ${gallery.length + 1}`, isLive: true }));
    }
  }

  if (!gallery.length && normalVideo) {
    gallery.push(makeGallery({
      url: normalVideo,
      kind: "video",
      previewUrl: firstString(data.cover, data.origin_cover, data.dynamic_cover, data.ai_dynamic_cover) || undefined,
      label: "Video utama",
      isLive: liveHint,
    }));
  }

  const hasVideo = gallery.some((item) => item.kind === "video");
  const hasImage = gallery.some((item) => item.kind === "image");
  const contentType = images.length
    ? hasVideo
      ? hasImage ? "Foto Mix Live" : gallery.length > 1 ? "Foto Live Slide" : "Foto Live"
      : "Foto Slide"
    : liveHint ? "Foto Live" : "Video";

  const downloads = uniqueByUrl([
    ...gallery.map((item, index) => makeDownload({
      url: item.url,
      kind: item.kind,
      label: item.isLive ? `Foto Live ${index + 1}` : item.kind === "image" ? `Foto ${index + 1}` : "Video HD",
      quality: item.kind === "video" ? "HD" : "Original",
      format: item.kind === "video" ? "MP4" : item.kind === "image" ? "JPG" : undefined,
      thumbnail: item.previewUrl,
    })),
    ...(normalVideo && !gallery.some((item) => item.url === normalVideo)
      ? [makeDownload({ url: normalVideo, kind: "video", label: "Video HD", quality: "HD", format: "MP4" })]
      : []),
    ...(music ? [makeDownload({ url: music, kind: "audio", label: "Musik / audio", format: "MP3" })] : []),
  ]);

  const thumbnail = firstString(
    gallery[0]?.previewUrl,
    gallery[0]?.kind === "image" ? gallery[0]?.url : "",
    data.cover,
    data.origin_cover,
    data.dynamic_cover,
    data.ai_dynamic_cover,
  );
  const firstVideo = gallery.find((item) => item.kind === "video")?.url;
  const firstImage = gallery.find((item) => item.kind === "image")?.url;
  const username = firstString(author.unique_id, author.username) || "tiktok_user";
  const creatorName = firstString(author.nickname, author.unique_id, author.username) || "TikTok Creator";

  return {
    title: firstString(data.title, data.desc, data.caption) || `${contentType} TikTok`,
    author: creatorName,
    description: firstString(data.title, data.desc, data.caption) || undefined,
    thumbnail: thumbnail || undefined,
    duration: formatDuration(data.duration),
    platform,
    preview: {
      video: firstVideo,
      audio: !firstVideo && !firstImage ? music || undefined : undefined,
      image: !firstVideo ? firstImage || thumbnail || undefined : undefined,
    },
    downloads,
    gallery,
    creator: {
      name: creatorName,
      username,
      avatar: firstString(author.avatar, author.avatar_thumb, author.avatarMedium) || undefined,
      profileUrl: `https://www.tiktok.com/@${encodeURIComponent(username)}`,
    },
    stats: {
      views: safeNumber(data.play_count ?? data.playCount),
      likes: safeNumber(data.digg_count ?? data.diggCount),
      comments: safeNumber(data.comment_count ?? data.commentCount),
      shares: safeNumber(data.share_count ?? data.shareCount),
      favorites: safeNumber(data.collect_count ?? data.collectCount),
    },
    contentType,
    region: firstString(data.region, data.country, data.location).toUpperCase() || undefined,
    publishedAt: formatUnixDate(data.create_time ?? data.createTime),
    sourceUrl: originalUrl,
    provider: "TikWM",
  };
}

export async function tikTokDownload(url: string, platform: PlatformInfo): Promise<ProviderResult> {
  try {
    const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const payload = await fetchJson(endpoint) as TikWmResponse;
    if (payload.code !== 0 || !payload.data) {
      return { ok: false, status: 502, error: payload.msg || "TikWM tidak menemukan media dari tautan tersebut." };
    }
    const media = normalizeTikTok(payload.data, url, platform);
    if (!media.downloads.length) return { ok: false, status: 422, error: "TikWM merespons, tetapi daftar medianya kosong." };
    return { ok: true, status: 200, media };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.name === "AbortError" ? 504 : 502,
      error: error instanceof Error ? `TikTok gagal diproses: ${error.message}` : "TikTok gagal diproses.",
    };
  }
}


export interface TikTokProfileResult {
  ok: boolean;
  status: number;
  profile?: TikTokProfile;
  error?: string;
}

function normalizeRegionCode(value: unknown) {
  const code = safeString(value).toUpperCase();
  const aliases: Record<string, string> = { EN: "US", JA: "JP", KO: "KR", ZH: "CN", VI: "VN", MS: "MY", FIL: "PH", TL: "PH", IDN: "ID", INA: "ID" };
  return aliases[code] || (/^[A-Z]{2}$/.test(code) ? code : "");
}

function normalizeTikTokProfile(payload: AnyRecord, fallbackUsername: string): TikTokProfile {
  const user = record(payload.user ?? payload);
  const stats = record(payload.stats ?? payload.statsV2 ?? payload);
  const username = firstString(user.uniqueId, user.unique_id, user.username, fallbackUsername).replace(/^@/, "");
  const nickname = firstString(user.nickname, user.nickName, user.displayName, username) || "TikTok Creator";
  return {
    username,
    nickname,
    avatar: firstString(user.avatarLarger, user.avatarMedium, user.avatarThumb, user.avatar) || undefined,
    bio: firstString(user.signature, user.bio, user.desc) || undefined,
    userId: firstString(user.id, user.uid, user.userId) || undefined,
    secUid: firstString(user.secUid, user.sec_uid) || undefined,
    verified: Boolean(user.verified),
    privateAccount: Boolean(user.privateAccount || user.private || user.secret),
    region: normalizeRegionCode(user.region ?? user.country ?? user.countryCode ?? user.language ?? payload.region) || undefined,
    followers: safeNumber(stats.followerCount ?? stats.followers ?? stats.follower_count),
    following: safeNumber(stats.followingCount ?? stats.following ?? stats.following_count),
    likes: safeNumber(stats.heartCount ?? stats.diggCount ?? stats.likes ?? stats.heart),
    videos: safeNumber(stats.videoCount ?? stats.videos ?? stats.video_count),
    friends: safeNumber(stats.friendCount ?? stats.friends),
    profileUrl: `https://www.tiktok.com/@${encodeURIComponent(username)}`,
  };
}

export async function tikTokProfile(username: string): Promise<TikTokProfileResult> {
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!cleanUsername || !/^[a-zA-Z0-9._-]{2,40}$/.test(cleanUsername)) {
    return { ok: false, status: 400, error: "Username TikTok tidak valid." };
  }

  const endpoints = [
    `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanUsername)}`,
    `https://www.tikwm.com/api/user/info?username=${encodeURIComponent(cleanUsername)}`,
    `https://www.tikwm.com/api/user/info?url=${encodeURIComponent(`https://www.tiktok.com/@${cleanUsername}`)}`,
  ];

  let lastError = "Profil TikTok belum bisa diambil.";
  for (const endpoint of endpoints) {
    try {
      const response = await fetchJson(endpoint, undefined, 30_000) as TikWmResponse;
      const data = response.data;
      if ((response.code === 0 && data) || (data && (record(data).user || record(data).stats))) {
        return { ok: true, status: 200, profile: normalizeTikTokProfile(record(data), cleanUsername) };
      }
      lastError = response.msg || lastError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  return { ok: false, status: 502, error: lastError };
}

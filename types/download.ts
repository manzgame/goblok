export type MediaKind = "video" | "audio" | "image" | "file";

export interface PlatformInfo {
  id: string;
  name: string;
  shortName: string;
  hostname: string;
}

export interface MediaDownload {
  id: string;
  kind: MediaKind;
  url: string;
  label: string;
  quality?: string;
  format?: string;
  size?: string;
  thumbnail?: string;
}

export interface MediaGalleryItem {
  id: string;
  kind: Exclude<MediaKind, "file">;
  url: string;
  previewUrl?: string;
  label: string;
  isLive?: boolean;
}

export interface MediaCreator {
  name: string;
  username?: string;
  avatar?: string;
  profileUrl?: string;
}

export interface MediaStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  favorites?: number;
}

export interface TikTokProfile {
  username: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  userId?: string;
  secUid?: string;
  verified?: boolean;
  privateAccount?: boolean;
  region?: string;
  followers?: number;
  following?: number;
  likes?: number;
  videos?: number;
  friends?: number;
  profileUrl: string;
}

export interface TikTokProfileApiResponse {
  success: boolean;
  profile?: TikTokProfile;
  error?: string;
}

export interface NormalizedMedia {
  title: string;
  author?: string;
  description?: string;
  thumbnail?: string;
  duration?: string;
  album?: string;
  platform: PlatformInfo;
  preview: {
    video?: string;
    audio?: string;
    image?: string;
  };
  downloads: MediaDownload[];
  gallery?: MediaGalleryItem[];
  creator?: MediaCreator;
  stats?: MediaStats;
  contentType?: string;
  region?: string;
  publishedAt?: string;
  sourceUrl?: string;
  provider?: string;
}

export interface DownloadApiResponse {
  success: boolean;
  input: string;
  platform: PlatformInfo;
  media?: NormalizedMedia;
  error?: string;
}

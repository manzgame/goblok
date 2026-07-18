"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  FileDown,
  Globe2,
  Heart,
  History,
  Image as ImageIcon,
  Layers3,
  Link2,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Moon,
  Music2,
  Palette,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  UserSearch,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { MediaPreview } from "@/components/media-preview";
import { PlatformIcon } from "@/components/platform-icon";
import { detectPlatform, SUPPORTED_PLATFORMS } from "@/lib/platforms";
import { filenameForMedia, proxyMediaUrl } from "@/lib/media-client";
import type { DownloadApiResponse, MediaDownload, MediaKind, MediaStats, TikTokProfile, TikTokProfileApiResponse } from "@/types/download";

type Theme = "light" | "dark";
type Accent = "mono" | "lime" | "sky" | "violet" | "coral";

interface HistoryItem {
  url: string;
  title: string;
  platform: string;
  platformName: string;
  createdAt: number;
}

const ACCENTS: Array<{ id: Accent; name: string }> = [
  { id: "mono", name: "Mono" },
  { id: "lime", name: "Lime" },
  { id: "sky", name: "Sky" },
  { id: "violet", name: "Violet" },
  { id: "coral", name: "Coral" },
];

const KIND_META: Record<MediaKind, { label: string; icon: typeof Video }> = {
  video: { label: "Video", icon: Video },
  audio: { label: "Audio", icon: Music2 },
  image: { label: "Gambar", icon: ImageIcon },
  file: { label: "Berkas", icon: FileDown },
};

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isProcessableInput(value: string) {
  return isValidHttpUrl(value) || /^pinterest\s*:\s*\S.{1,}$/i.test(value);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatCount(value?: number) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("id-ID", {
    notation: amount >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(amount);
}

function normalizeRegionCode(value?: string) {
  const code = String(value || "").trim().toUpperCase();
  const aliases: Record<string, string> = { EN: "US", JA: "JP", KO: "KR", ZH: "CN", VI: "VN", MS: "MY", FIL: "PH", TL: "PH", IDN: "ID", INA: "ID" };
  return aliases[code] || (/^[A-Z]{2}$/.test(code) ? code : "");
}

function countryFlag(value?: string) {
  const code = normalizeRegionCode(value);
  if (!code) return "";
  return code.split("").map((character) => String.fromCodePoint(127397 + character.charCodeAt(0))).join("");
}

function formatRegion(value?: string) {
  const code = normalizeRegionCode(value);
  return code ? `${code} ${countryFlag(code)}` : "Tidak diketahui";
}

function waitForAudioReady(url: string, timeoutMs = 36_000) {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (error) reject(error); else resolve();
    };
    const timer = window.setTimeout(() => finish(new Error("File audio ditemukan, tetapi belum siap diputar. Coba proses ulang beberapa saat lagi.")), timeoutMs);
    audio.preload = "auto";
    audio.addEventListener("canplay", () => finish(), { once: true });
    audio.addEventListener("error", () => finish(new Error("File audio dari provider tidak dapat dimuat untuk preview.")), { once: true });
    audio.src = url.startsWith("blob:") || url.startsWith("data:") ? url : proxyMediaUrl(url);
    audio.load();
  });
}

function safeHostname(value: string) {
  if (/^pinterest\s*:/i.test(value)) return "pencarian Pinterest";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function LoadingSkeleton() {
  return (
    <section className="result-card skeleton-card" aria-label="Sedang memproses media" aria-busy="true">
      <div className="skeleton-media skeleton" />
      <div className="skeleton-content">
        <div className="skeleton skeleton-pill" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line wide" />
        <div className="skeleton skeleton-line medium" />
        <div className="skeleton-downloads">
          <div className="skeleton skeleton-download" />
          <div className="skeleton skeleton-download" />
          <div className="skeleton skeleton-download" />
        </div>
      </div>
    </section>
  );
}

function GalleryVideoThumbnail({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [src]);

  return (
    <div className={`gallery-video-thumb ${ready ? "ready" : ""} ${failed ? "failed" : ""}`}>
      {!ready && <ImageIcon size={20} aria-hidden="true" />}
      {!failed && (
        <video
          src={proxyMediaUrl(src)}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            try {
              const target = Number.isFinite(video.duration) && video.duration > 0
                ? Math.min(0.12, Math.max(0.02, video.duration / 20))
                : 0.06;
              video.currentTime = target;
            } catch {
              setReady(true);
            }
          }}
          onLoadedData={() => setReady(true)}
          onSeeked={() => setReady(true)}
          onError={() => {
            setReady(false);
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}

function SafeThumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (failed) return <ImageIcon size={20} aria-hidden="true" />;
  return <img src={proxyMediaUrl(src)} alt="" onError={() => setFailed(true)} />;
}

function DownloadItem({
  item,
  mediaTitle,
  platformId,
  artist,
  artwork,
  expectedDuration,
  onCopy,
  onDownload,
}: {
  item: MediaDownload;
  mediaTitle: string;
  platformId: string;
  artist?: string;
  artwork?: string;
  expectedDuration?: string;
  onCopy: (url: string) => void;
  onDownload: () => void;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const isTikTokGallery = platformId === "tiktok" && /^Foto(?:\s+Live)?\s+\d+/i.test(item.label || "");
  const hideThumbnail = platformId === "tiktok" && item.kind === "video" && !isTikTokGallery;
  const filename = platformId === "spotify"
    ? filenameForMedia(mediaTitle, "", item.format)
    : filenameForMedia(mediaTitle, item.label || meta.label, item.format);
  const downloadUrl = proxyMediaUrl(item.url, {
    download: true,
    filename,
    cover: platformId === "spotify" ? artwork : undefined,
    title: platformId === "spotify" ? mediaTitle : undefined,
    artist: platformId === "spotify" ? artist : undefined,
    expectedDuration: platformId === "spotify" ? expectedDuration : undefined,
  });

  return (
    <article className={`download-item ${isTikTokGallery ? "download-item-gallery" : ""} ${hideThumbnail ? "download-item-no-thumb" : ""}`}>
      <div className={`download-kind kind-${item.kind}`}>
        {isTikTokGallery && item.kind === "video" ? (
          <GalleryVideoThumbnail src={item.url} />
        ) : !hideThumbnail && item.thumbnail ? (
          <SafeThumbnail src={item.thumbnail} />
        ) : (
          <Icon size={19} />
        )}
      </div>
      <div className="download-info">
        <div className="download-title-row">
          <h4>{item.label || meta.label}</h4>
          <span className="download-kind-label">{meta.label}</span>
        </div>
        <div className="download-meta">
          {item.quality && <span>{item.quality}</span>}
          {item.format && <span>{item.format}</span>}
          {item.size && <span>{item.size}</span>}
          {!item.quality && !item.format && !item.size && <span>Media siap diunduh</span>}
        </div>
      </div>
      <div className="download-actions">
        {!isTikTokGallery && (
          <button className="icon-button" type="button" onClick={() => onCopy(item.url)} aria-label="Salin tautan media" title="Salin tautan">
            <Copy size={17} />
          </button>
        )}
        <a
          className={isTikTokGallery ? "gallery-download-button" : "mini-3d-button"}
          href={downloadUrl}
          download={filename}
          onClick={onDownload}
          aria-label={`Unduh ${item.label || meta.label}`}
          title={`Unduh ${item.label || meta.label}`}
        >
          <ArrowDownToLine size={17} />
          {!isTikTokGallery && <span>Unduh</span>}
        </a>
      </div>
    </article>
  );
}

function CaptionBox({ text, onCopy }: { text: string; onCopy: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 180;

  useEffect(() => setExpanded(false), [text]);

  return (
    <div className="caption-panel">
      <div className="caption-panel-head">
        <span>CAPTION / DESKRIPSI</span>
        <button type="button" onClick={() => onCopy(text)}><Copy size={15} /> Salin</button>
      </div>
      <p className={expanded ? "expanded" : ""}>{text}</p>
      {isLong && (
        <button className="caption-toggle" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Tampilkan sedikit" : "Tampilkan semua"}
        </button>
      )}
    </div>
  );
}

function CreatorCard({
  creator,
  canCheckProfile,
  profileLoading,
  onCheckProfile,
}: {
  creator: NonNullable<DownloadApiResponse["media"]>["creator"];
  canCheckProfile?: boolean;
  profileLoading?: boolean;
  onCheckProfile?: () => void;
}) {
  if (!creator) return null;
  return (
    <div className="creator-card">
      <div className="creator-avatar">
        {creator.avatar ? <img src={proxyMediaUrl(creator.avatar)} alt={creator.name} /> : <UserRound size={22} />}
      </div>
      <div className="creator-copy">
        <strong>{creator.name}</strong>
        {creator.username && <span>@{creator.username}</span>}
      </div>
      <div className="creator-actions">
        {canCheckProfile && onCheckProfile && (
          <button className="profile-check-button" type="button" onClick={onCheckProfile} disabled={profileLoading}>
            {profileLoading ? <LoaderCircle size={16} className="spin-icon" /> : <UserSearch size={16} />}
            <span>{profileLoading ? "Memuat..." : "Cek profil"}</span>
          </button>
        )}
        {creator.profileUrl && (
          <a href={creator.profileUrl} target="_blank" rel="noopener noreferrer" aria-label="Buka profil kreator">
            <ExternalLink size={17} />
          </a>
        )}
      </div>
    </div>
  );
}

function StatsGrid({ stats, region }: { stats?: MediaStats; region?: string }) {
  if (!stats && !region) return null;
  const entries = [
    { key: "views", label: "Views", icon: Eye, value: formatCount(stats?.views) },
    { key: "likes", label: "Likes", icon: Heart, value: formatCount(stats?.likes) },
    { key: "comments", label: "Komentar", icon: MessageCircle, value: formatCount(stats?.comments) },
    { key: "shares", label: "Share", icon: Share2, value: formatCount(stats?.shares) },
    { key: "favorites", label: "Favorit", icon: Bookmark, value: formatCount(stats?.favorites) },
    { key: "region", label: "Lokasi", icon: Globe2, value: formatRegion(region) },
  ];

  return (
    <div className="stats-grid-rich">
      {entries.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key}>
            <span><Icon size={16} /></span>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </div>
        );
      })}
    </div>
  );
}

function TikTokProfilePanel({ profile, loading, error }: { profile: TikTokProfile | null; loading: boolean; error: string }) {
  if (!profile && !loading && !error) return null;
  if (loading) {
    return (
      <div className="profile-panel profile-panel-loading">
        <div className="profile-skeleton-avatar skeleton" />
        <div className="profile-skeleton-copy"><div className="skeleton" /><div className="skeleton" /></div>
        <LoaderCircle size={20} className="spin-icon" />
      </div>
    );
  }
  if (error) return <div className="profile-panel-error"><AlertTriangle size={17} /> {error}</div>;
  if (!profile) return null;

  const items = [
    { label: "Followers", value: formatCount(profile.followers), icon: Users },
    { label: "Following", value: formatCount(profile.following), icon: UserRound },
    { label: "Total likes", value: formatCount(profile.likes), icon: Heart },
    { label: "Video", value: formatCount(profile.videos), icon: Video },
    { label: "Teman", value: formatCount(profile.friends), icon: Users },
    { label: "Region", value: formatRegion(profile.region), icon: Globe2 },
  ];

  return (
    <section className="profile-panel">
      <div className="profile-panel-head">
        <div className="profile-panel-avatar">{profile.avatar ? <img src={proxyMediaUrl(profile.avatar)} alt={profile.nickname} /> : <UserRound size={28} />}</div>
        <div className="profile-panel-copy">
          <div className="profile-panel-name"><strong>{profile.nickname}</strong>{profile.verified && <CheckCircle2 size={16} />}</div>
          <span>@{profile.username}</span>
          <div className="profile-flags"><em>{profile.privateAccount ? "Private" : "Public"}</em><em>{profile.verified ? "Verified" : "Belum verified"}</em></div>
        </div>
        <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /></a>
      </div>
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      <div className="profile-stats-grid">
        {items.map((item) => { const Icon = item.icon; return <div key={item.label}><span><Icon size={15} /></span><strong>{item.value}</strong><small>{item.label}</small></div>; })}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [accent, setAccent] = useState<Accent>("mono");
  const [accentMenuOpen, setAccentMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DownloadApiResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState<TikTokProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preparedAudioUrlRef = useRef<string | null>(null);

  const platform = useMemo(() => detectPlatform(url), [url]);
  const validInput = isProcessableInput(url.trim());

  useEffect(() => {
    const savedTheme = localStorage.getItem("datzon-theme") as Theme | null;
    const savedAccent = localStorage.getItem("datzon-accent") as Accent | null;
    const storedHistory = localStorage.getItem("datzon-history");
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    setTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : preferredTheme);
    setAccent(ACCENTS.some((item) => item.id === savedAccent) ? savedAccent! : "mono");

    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 6));
      } catch {
        localStorage.removeItem("datzon-history");
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (preparedAudioUrlRef.current) URL.revokeObjectURL(preparedAudioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem("datzon-theme", theme);
    localStorage.setItem("datzon-accent", accent);
  }, [theme, accent]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".accent-picker")) setAccentMenuOpen(false);
    }
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return showToast("Clipboard masih kosong.");
      setUrl(text.trim());
      setError("");
      inputRef.current?.focus();
    } catch {
      showToast("Browser tidak mengizinkan akses clipboard.");
    }
  }

  async function copyText(value: string, successMessage = "Tautan media disalin.") {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage);
    } catch {
      showToast("Teks gagal disalin.");
    }
  }

  function saveHistory(data: DownloadApiResponse) {
    if (!data.media) return;
    const next: HistoryItem[] = [
      {
        url: data.input,
        title: data.media.title,
        platform: data.platform.id,
        platformName: data.platform.name,
        createdAt: Date.now(),
      },
      ...history.filter((item) => item.url !== data.input),
    ].slice(0, 6);

    setHistory(next);
    localStorage.setItem("datzon-history", JSON.stringify(next));
  }

  function revokePreparedAudio() {
    if (!preparedAudioUrlRef.current) return;
    URL.revokeObjectURL(preparedAudioUrlRef.current);
    preparedAudioUrlRef.current = null;
  }

  async function prepareSpotifyResponse(data: DownloadApiResponse, signal: AbortSignal) {
    if (data.platform.id !== "spotify" || !data.media) return data;

    const audioItem = data.media.downloads.find((item) => item.kind === "audio");
    if (!audioItem?.url) throw new Error("Audio Spotify tidak ditemukan oleh provider.");

    const filename = filenameForMedia(data.media.title, "", audioItem.format || "mp3");
    const preparedUrl = proxyMediaUrl(audioItem.url, {
      download: true,
      filename,
      cover: data.media.thumbnail,
      title: data.media.title,
      artist: data.media.author,
      expectedDuration: data.media.duration,
    });

    const preparedRequest = await fetch(preparedUrl, {
      method: "GET",
      cache: "no-store",
      signal,
    });

    if (!preparedRequest.ok) {
      let message = "Audio Spotify belum siap diputar atau diunduh.";
      try {
        const payload = await preparedRequest.json() as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        const text = await preparedRequest.text().catch(() => "");
        if (text.trim()) message = text.trim().slice(0, 240);
      }
      throw new Error(message);
    }

    const rawBlob = await preparedRequest.blob();
    if (rawBlob.size < 24_000) throw new Error("Berkas audio Spotify terlalu kecil atau belum selesai diproses.");
    const audioBlob = rawBlob.type.startsWith("audio/")
      ? rawBlob
      : new Blob([rawBlob], { type: "audio/mpeg" });
    const objectUrl = URL.createObjectURL(audioBlob);

    try {
      await waitForAudioReady(objectUrl, 18_000);
    } catch (audioError) {
      URL.revokeObjectURL(objectUrl);
      throw audioError;
    }

    revokePreparedAudio();
    preparedAudioUrlRef.current = objectUrl;

    return {
      ...data,
      media: {
        ...data.media,
        preview: { ...data.media.preview, audio: objectUrl },
        downloads: data.media.downloads.map((item) => item.kind === "audio" ? { ...item, url: objectUrl } : item),
        gallery: data.media.gallery?.map((item) => item.kind === "audio" ? { ...item, url: objectUrl } : item),
      },
    } satisfies DownloadApiResponse;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanUrl = url.trim();

    if (!isProcessableInput(cleanUrl)) {
      setError("Masukkan URL valid. Untuk pencarian gambar, gunakan format pinterest: kata kunci.");
      inputRef.current?.focus();
      return;
    }

    revokePreparedAudio();
    setLoading(true);
    setResponse(null);
    setError("");
    setProfile(null);
    setProfileError("");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), platform.id === "spotify" ? 150_000 : 90_000);

    try {
      const request = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl }),
        signal: controller.signal,
      });
      let data = (await request.json()) as DownloadApiResponse;

      if (!request.ok || !data.success || !data.media) throw new Error(data.error || "Media gagal diproses.");
      if (data.platform.id === "spotify") data = await prepareSpotifyResponse(data, controller.signal);

      setResponse(data);
      saveHistory(data);
      window.setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (requestError) {
      setError(
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "Proses terlalu lama. Coba lagi atau gunakan tautan publik yang berbeda."
          : requestError instanceof Error
            ? requestError.message
            : "Terjadi kesalahan saat memproses media.",
      );
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function loadTikTokProfile() {
    const username = response?.media?.creator?.username;
    if (!username || profileLoading) return;
    if (profile) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    setProfileError("");
    try {
      const request = await fetch("/api/tiktok/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = (await request.json()) as TikTokProfileApiResponse;
      if (!request.ok || !data.success || !data.profile) throw new Error(data.error || "Profil TikTok gagal dimuat.");
      setProfile(data.profile);
    } catch (requestError) {
      setProfileError(requestError instanceof Error ? requestError.message : "Profil TikTok gagal dimuat.");
    } finally {
      setProfileLoading(false);
    }
  }

  function resetDownloader() {
    revokePreparedAudio();
    setUrl("");
    setResponse(null);
    setError("");
    setProfile(null);
    setProfileError("");
    inputRef.current?.focus();
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("datzon-history");
    showToast("Riwayat lokal dibersihkan.");
  }

  return (
    <div className="site-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <div className="container nav-inner">
          <a className="brand" href="#top" aria-label="DATZON Downloader beranda">
            <BrandLogo className="brand-mark" />
            <div className="brand-copy"><strong>DATZON</strong><span>DOWNLOADER</span></div>
          </a>

          <div className="nav-actions">
            <div className="status-pill desktop-only"><span className="status-dot" /> Multi-provider engine</div>
            <div className="accent-picker">
              <button className="nav-button accent-trigger" type="button" onClick={() => setAccentMenuOpen((open) => !open)} aria-expanded={accentMenuOpen} aria-label="Pilih warna aksen">
                <Palette size={18} /><span className={`accent-preview accent-${accent}`} /><ChevronDown size={15} />
              </button>
              {accentMenuOpen && (
                <div className="accent-menu">
                  <div className="accent-menu-label">AKSEN WARNA</div>
                  {ACCENTS.map((option) => (
                    <button key={option.id} type="button" className={accent === option.id ? "active" : ""} onClick={() => { setAccent(option.id); setAccentMenuOpen(false); }}>
                      <span className={`accent-swatch accent-${option.id}`} /><span>{option.name}</span>{accent === option.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="nav-button theme-button" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Aktifkan mode gelap" : "Aktifkan mode terang"}>
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="eyebrow"><Sparkles size={15} /> Preview langsung, bukan kartu kosong</div>
          <h1>Unduh media.<br /><span>Tanpa ribet.</span></h1>
          <p className="hero-copy">TikTok, Spotify, Pinterest, YouTube, Instagram, dan platform lain disatukan dalam satu tampilan yang benar-benar menampilkan medianya.</p>

          <div className="downloader-panel">
            <form onSubmit={handleSubmit}>
              <div className={`url-field ${url && validInput ? "valid" : ""} ${error ? "invalid" : ""}`}>
                <div className="url-leading">{url ? <PlatformIcon id={platform.id} className="platform-svg" /> : <Link2 size={21} />}</div>
                <div className="url-input-wrap">
                  <label htmlFor="media-url">TAUTAN MEDIA</label>
                  <input
                    ref={inputRef}
                    id="media-url"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Tempel link atau ketik pinterest: anime"
                    value={url}
                    onChange={(event) => { setUrl(event.target.value); setError(""); }}
                    disabled={loading}
                  />
                </div>
                <div className="url-actions">
                  {url && <button type="button" className="field-icon-button" onClick={() => setUrl("")} aria-label="Hapus tautan"><X size={18} /></button>}
                  <button type="button" className="paste-button" onClick={pasteFromClipboard} disabled={loading} aria-label="Tempel dari clipboard" title="Tempel dari clipboard">
                    <Clipboard size={17} /><span>Tempel</span>
                  </button>
                </div>
              </div>

              <div className="detector-row">
                <div className="detected-platform">
                  <span className={`detect-light ${url && validInput ? "on" : ""}`} />
                  {url && validInput ? <><strong>{platform.name}</strong><span>terdeteksi dari {platform.hostname || safeHostname(url)}</span></> : <span>Platform terdeteksi otomatis setelah tautan ditempel</span>}
                </div>
                <span className="privacy-note"><ShieldCheck size={15} /> Riwayat hanya tersimpan di perangkat</span>
              </div>

              <button className="primary-3d-button" type="submit" disabled={!validInput || loading}>
                <span className="button-icon-wrap">{loading ? <span className="spinner" /> : <ArrowDownToLine size={21} />}</span>
                <span>{loading ? "Sedang memproses..." : "Proses media"}</span>
                {!loading && <span className="button-key">ENTER</span>}
              </button>
            </form>

            <div className="panel-footer"><div><Zap size={16} /> Deteksi otomatis</div><div><Layers3 size={16} /> Banyak format</div><div><ShieldCheck size={16} /> Tautan publik</div></div>
          </div>

          <div className="platform-strip" aria-label="Platform yang didukung">
            {SUPPORTED_PLATFORMS.slice(0, 10).map((item) => <div className="platform-chip" key={item.id} title={item.name}><PlatformIcon id={item.id} className="platform-svg" /><span>{item.name}</span></div>)}
          </div>
        </section>

        <section className="content-section container" id="result">
          {loading && <LoadingSkeleton />}

          {!loading && error && (
            <div className="error-card" role="alert">
              <div className="error-icon"><AlertTriangle size={24} /></div>
              <div><span>MEDIA BELUM BERHASIL DIPROSES</span><h3>Ada masalah dengan tautan ini</h3><p>{error}</p></div>
              <button className="secondary-button" type="button" onClick={() => inputRef.current?.focus()}><RotateCcw size={17} /> Coba lagi</button>
            </div>
          )}

          {!loading && response?.media && (
            <section className="result-card result-enter">
              <div className="preview-column"><MediaPreview media={response.media} /></div>

              <div className="result-body">
                {response.platform.id !== "spotify" && (
                  <CreatorCard
                    creator={response.media.creator}
                    canCheckProfile={response.platform.id === "tiktok" && Boolean(response.media.creator?.username)}
                    profileLoading={profileLoading}
                    onCheckProfile={loadTikTokProfile}
                  />
                )}
                {response.platform.id === "tiktok" && <TikTokProfilePanel profile={profile} loading={profileLoading} error={profileError} />}

                <div className="result-heading">
                  <div>
                    <div className="result-badge-row">
                      <div className="result-platform-badge"><PlatformIcon id={response.platform.id} className="platform-svg" />{response.platform.name}</div>
                      {response.media.contentType && <span className="content-type-badge">{response.media.contentType}</span>}
                    </div>
                    {response.platform.id !== "tiktok" && <h2>{response.media.title}</h2>}
                    <div className="result-subline">
                      {response.media.author && <span><UserRound size={14} /> {response.media.author}</span>}
                      {response.media.album && <span><Layers3 size={14} /> {response.media.album}</span>}
                      {response.media.duration && <span><Clock3 size={14} /> {response.media.duration}</span>}
                      {response.media.region && <span><MapPin size={14} /> {response.media.region}</span>}
                      {response.media.publishedAt && <span><CalendarDays size={14} /> {response.media.publishedAt}</span>}
                      {response.media.provider && <span><CheckCircle2 size={14} /> {response.media.provider}</span>}
                    </div>
                  </div>
                  <button className="icon-button reset-result" type="button" onClick={resetDownloader} aria-label="Proses tautan baru" title="Tautan baru"><RotateCcw size={18} /></button>
                </div>

                {response.platform.id !== "spotify" && response.media.description && <CaptionBox text={response.media.description} onCopy={(text) => copyText(text, "Caption disalin.")} />}
                {response.platform.id === "tiktok" && <StatsGrid stats={response.media.stats} region={response.media.region} />}

                {response.media.sourceUrl && isValidHttpUrl(response.media.sourceUrl) && (
                  <a className="source-link" href={response.media.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Buka link asli</a>
                )}

                <div className="download-section-heading">
                  <div><span>PILIH FORMAT</span><h3>Siap untuk diunduh</h3></div>
                  <span className="download-note">Preview tampil langsung. Tombol di bawah khusus untuk menyimpan file.</span>
                </div>

                <div className="download-list">
                  {response.media.downloads.map((item) => (
                    <DownloadItem
                      key={item.id}
                      item={item}
                      mediaTitle={response.media!.title}
                      platformId={response.platform.id}
                      artist={response.media?.author}
                      artwork={response.media?.thumbnail}
                      expectedDuration={response.media?.duration}
                      onCopy={(link) => copyText(link)}
                      onDownload={() => showToast("Download sedang diproses. Tetap di halaman ini.")}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </section>

        <section className="lower-grid container">
          <article className="feature-card featured"><div className="feature-number">01</div><div className="feature-icon"><Zap size={22} /></div><h3>Provider sesuai platform</h3><p>TikTok, Spotify, dan Pinterest memakai mesin khusus. Platform lain tetap memakai backend universal.</p></article>
          <article className="feature-card"><div className="feature-number">02</div><div className="feature-icon"><Layers3 size={22} /></div><h3>Video, musik, dan slide langsung terlihat</h3><p>Hasil pertama otomatis tampil. Galeri foto dan live photo bisa dipindah dari thumbnail tanpa membuka tab baru.</p></article>
          <article className="feature-card"><div className="feature-number">03</div><div className="feature-icon"><ShieldCheck size={22} /></div><h3>Privasi lokal</h3><p>Riwayat tampilan disimpan di browser perangkatmu dan bisa dibersihkan kapan saja.</p></article>
        </section>

        {history.length > 0 && (
          <section className="history-section container">
            <div className="section-heading-row"><div><span className="section-kicker"><History size={15} /> RIWAYAT LOKAL</span><h2>Baru saja diproses</h2></div><button className="text-button danger" type="button" onClick={clearHistory}><Trash2 size={16} /> Bersihkan</button></div>
            <div className="history-grid">
              {history.map((item) => (
                <button className="history-item" key={`${item.url}-${item.createdAt}`} type="button" onClick={() => { setUrl(item.url); setResponse(null); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <div className="history-platform"><PlatformIcon id={item.platform} className="platform-svg" /></div>
                  <div className="history-copy"><strong>{item.title}</strong><span>{item.platformName} · {formatDate(item.createdAt)}</span></div>
                  <ExternalLink size={17} />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand"><BrandLogo className="brand-mark small" /><div><strong>DATZON DOWNLOADER</strong><span>Multi-provider media utility</span></div></div>
          <p>Gunakan hanya untuk media yang kamu miliki atau memang diizinkan untuk diunduh. Konten berhak cipta tetap milik pemiliknya.</p>
          <span>© {new Date().getFullYear()} DATZON</span>
        </div>
      </footer>

      {toast && <div className="toast"><CheckCircle2 size={18} /> {toast}</div>}
    </div>
  );
}

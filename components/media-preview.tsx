"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Expand,
  Image as ImageIcon,
  Music2,
  Pause,
  Play,
  Video,
  X,
} from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { filenameForMedia, proxyMediaUrl } from "@/lib/media-client";
import type { MediaGalleryItem, NormalizedMedia } from "@/types/download";

function fallbackItems(media: NormalizedMedia): MediaGalleryItem[] {
  if (media.preview.video) return [{ id: "preview-video", kind: "video", url: media.preview.video, previewUrl: media.thumbnail, label: "Video utama" }];
  if (media.preview.audio) return [{ id: "preview-audio", kind: "audio", url: media.preview.audio, previewUrl: media.thumbnail, label: "Audio utama" }];
  if (media.preview.image) return [{ id: "preview-image", kind: "image", url: media.preview.image, previewUrl: media.preview.image, label: "Gambar utama" }];
  return [];
}

function mediaFormat(item: MediaGalleryItem) {
  return item.kind === "video" ? "mp4" : item.kind === "audio" ? "mp3" : "jpg";
}

export function MediaPreview({ media }: { media: NormalizedMedia }) {
  const items = useMemo(() => media.gallery?.length ? media.gallery : fallbackItems(media), [media]);
  const music = useMemo(() => media.downloads.find((item) => item.kind === "audio")?.url || media.preview.audio || "", [media]);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setActive(0);
    setViewerOpen(false);
    setMusicPlaying(false);
    musicRef.current?.pause();
  }, [media.sourceUrl, media.title]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft") setActive((index) => (index - 1 + items.length) % items.length);
      if (event.key === "ArrowRight") setActive((index) => (index + 1) % items.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerOpen, items.length]);

  const selected = items[Math.min(active, Math.max(0, items.length - 1))];
  if (!selected) return null;

  const selectedSrc = proxyMediaUrl(selected.url);
  const selectedPoster = proxyMediaUrl(selected.previewUrl || media.thumbnail);
  const selectedFilename = media.platform.id === "spotify"
    ? filenameForMedia(media.title, "", mediaFormat(selected))
    : filenameForMedia(media.title, selected.label, mediaFormat(selected));
  const selectedDownload = proxyMediaUrl(selected.url, {
    download: true,
    filename: selectedFilename,
    cover: media.platform.id === "spotify" ? media.thumbnail : undefined,
    title: media.platform.id === "spotify" ? media.title : undefined,
    artist: media.platform.id === "spotify" ? media.author : undefined,
    expectedDuration: media.platform.id === "spotify" ? media.duration : undefined,
  });
  const musicSrc = proxyMediaUrl(music);

  async function toggleMusic() {
    const audio = musicRef.current;
    if (!audio || !music) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setMusicPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  function previousItem() {
    setActive((index) => (index - 1 + items.length) % items.length);
  }

  function nextItem() {
    setActive((index) => (index + 1) % items.length);
  }

  function renderPreviewContent(modal = false) {
    if (selected.kind === "video") {
      return (
        <video
          key={`${selected.url}-${modal ? "modal" : "inline"}`}
          className={modal ? "viewer-video" : "video-preview"}
          src={selectedSrc}
          poster={selectedPoster || undefined}
          controls
          playsInline
          preload="metadata"
        />
      );
    }
    if (selected.kind === "audio") {
      return <AudioPlayer src={selectedSrc} title={media.title} artwork={selectedPoster || proxyMediaUrl(media.thumbnail)} />;
    }
    return (
      <div className={modal ? "viewer-image-wrap" : "image-preview-wrap"}>
        <img
          key={selected.url}
          className={modal ? "viewer-image" : "image-preview"}
          src={selectedSrc}
          alt={selected.label || media.title}
        />
      </div>
    );
  }

  const modal = mounted && viewerOpen ? createPortal(
    <div className="media-viewer" role="dialog" aria-modal="true" aria-label={`Tampilan penuh ${selected.label}`}>
      <div className="media-viewer-backdrop" onClick={() => setViewerOpen(false)} />
      <div className="media-viewer-panel">
        <div className="media-viewer-toolbar">
          <div className="viewer-label">
            {selected.isLive ? "LIVE PHOTO" : selected.kind.toUpperCase()} <strong>{active + 1}/{items.length}</strong>
          </div>
          <div className="viewer-actions">
            {music && (
              <button type="button" onClick={toggleMusic} aria-label={musicPlaying ? "Jeda musik" : "Putar musik"} title={musicPlaying ? "Jeda musik" : "Putar musik"}>
                {musicPlaying ? <Pause size={20} /> : <Music2 size={20} />}
              </button>
            )}
            <a href={selectedDownload} download={selectedFilename} aria-label="Unduh media yang sedang dibuka" title="Unduh media"><ArrowDownToLine size={20} /></a>
            <button type="button" onClick={() => setViewerOpen(false)} aria-label="Tutup tampilan penuh" title="Tutup"><X size={22} /></button>
          </div>
        </div>
        <div className="media-viewer-stage">{renderPreviewContent(true)}</div>
        {items.length > 1 && (
          <>
            <button className="viewer-nav viewer-prev" type="button" onClick={previousItem} aria-label="Media sebelumnya"><ChevronLeft size={28} /></button>
            <button className="viewer-nav viewer-next" type="button" onClick={nextItem} aria-label="Media berikutnya"><ChevronRight size={28} /></button>
            <div className="viewer-counter">{active + 1} / {items.length}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="media-preview-shell">
      {music && (
        <audio
          ref={musicRef}
          src={musicSrc}
          preload="metadata"
          loop
          onPlay={() => setMusicPlaying(true)}
          onPause={() => setMusicPlaying(false)}
          onEnded={() => setMusicPlaying(false)}
        />
      )}
      <div className="preview-stage">
        <div className="preview-stage-badge">
          {selected.kind === "video" ? <Video size={14} /> : selected.kind === "audio" ? <Music2 size={14} /> : <ImageIcon size={14} />}
          <span>{selected.isLive ? "LIVE PHOTO" : selected.kind.toUpperCase()}</span>
          {items.length > 1 && <strong>{active + 1}/{items.length}</strong>}
        </div>
        <div className="preview-stage-actions">
          {music && selected.kind !== "audio" && (
            <button type="button" onClick={toggleMusic} aria-label={musicPlaying ? "Jeda musik" : "Putar musik"} title={musicPlaying ? "Jeda musik" : "Putar musik"}>
              {musicPlaying ? <Pause size={17} /> : <Music2 size={17} />}
            </button>
          )}
          <a href={selectedDownload} download={selectedFilename} aria-label={`Unduh ${selected.label}`} title={`Unduh ${selected.label}`}><ArrowDownToLine size={17} /></a>
          {selected.kind !== "audio" && (
            <button type="button" onClick={() => setViewerOpen(true)} aria-label="Buka tampilan penuh" title="Tampilan penuh"><Expand size={17} /></button>
          )}
        </div>
        {renderPreviewContent(false)}
      </div>

      {items.length > 1 && (
        <div className="preview-thumbnails" aria-label="Daftar media">
          {items.map((item, index) => (
            <button
              className={`preview-thumb ${index === active ? "active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => setActive(index)}
              onDoubleClick={() => setViewerOpen(true)}
              aria-label={`Tampilkan ${item.label}`}
            >
              {item.kind === "video" && item.isLive ? (
                <video src={`${proxyMediaUrl(item.url)}#t=0.08`} muted playsInline preload="metadata" aria-hidden="true" />
              ) : item.previewUrl || item.kind === "image" ? (
                <img src={proxyMediaUrl(item.previewUrl || item.url)} alt="" />
              ) : item.kind === "video" ? (
                <video src={`${proxyMediaUrl(item.url)}#t=0.08`} muted playsInline preload="metadata" aria-hidden="true" />
              ) : (
                <Music2 size={19} />
              )}
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      )}
      {modal}
    </div>
  );
}

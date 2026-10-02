import { Link } from "@inertiajs/react";
import { useEffect, useRef } from "react";
import type { CopyKey } from "@/lib/copy";
import type { GalleryKind, ServiceGallery } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

export const GALLERY_KIND: Record<GalleryKind, CopyKey> = {
  dominical: "gallery.kindSunday",
  "media-semana": "gallery.kindMidweek",
  especial: "gallery.kindSpecial",
};

type T = (key: CopyKey) => string;

export function GalleryCard({ gallery, t, featured = false }: { gallery: ServiceGallery; t: T; featured?: boolean }) {
  return (
    <Link href={`/galeria/${gallery.slug}`} className="gallery-card group" data-featured={featured || undefined}>
      <span className="gallery-card-photo">
        {gallery.cover ? <img src={gallery.cover} alt="" loading={featured ? "eager" : "lazy"} /> : null}
        <span className="gallery-card-count">
          {gallery.count} {t("gallery.photos")}
        </span>
      </span>
      <span className="gallery-card-body">
        <span className="gallery-card-meta">
          {featured ? <strong>{t("gallery.latest")}</strong> : null}
          <span>{t(GALLERY_KIND[gallery.kind])}</span>
          <span aria-hidden>·</span>
          <span>{formatSermonDate(gallery.service_date)}</span>
        </span>
        <span className="gallery-card-title">{gallery.title}</span>
        {featured && gallery.summary ? <span className="gallery-card-summary">{gallery.summary}</span> : null}
        <span className="gallery-card-open">{t("gallery.open")} →</span>
      </span>
    </Link>
  );
}

/** Full-screen photo viewer: arrows, Esc and swipe. */
export function Lightbox({
  photos,
  index,
  title,
  t,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number;
  title: string;
  t: T;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const swipe = useRef<number | null>(null);
  const count = photos.length;
  const go = (step: number) => onIndex((index + step + count) % count);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  });

  useEffect(() => {
    for (const near of [photos[(index + 1) % count], photos[(index - 1 + count) % count]]) {
      if (near) new Image().src = near;
    }
  }, [index, photos, count]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="lightbox-scrim" aria-label={t("gallery.close")} onClick={onClose} />
      <div className="lightbox-bar">
        <span>
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-2">
          <a href={photos[index]} target="_blank" rel="noreferrer" className="lightbox-chip">
            {t("gallery.download")} ↓
          </a>
          <button type="button" className="lightbox-chip" onClick={onClose}>
            {t("gallery.close")} ✕
          </button>
        </div>
      </div>
      <figure
        className="lightbox-stage"
        onPointerDown={(event) => (swipe.current = event.clientX)}
        onPointerUp={(event) => {
          if (swipe.current === null) return;
          const dx = event.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <img key={photos[index]} src={photos[index]} alt={`${title} · foto ${index + 1}`} draggable={false} />
      </figure>
      {count > 1 ? (
        <>
          <button type="button" className="lightbox-arrow" data-side="prev" aria-label="Foto anterior" onClick={() => go(-1)}>
            ←
          </button>
          <button type="button" className="lightbox-arrow" data-side="next" aria-label="Foto siguiente" onClick={() => go(1)}>
            →
          </button>
        </>
      ) : null}
    </div>
  );
}

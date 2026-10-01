import { useEffect, useMemo, useState } from "react";
import { mediaFocusStyle, videoMime, type MediaAsset } from "@/lib/media";

const SLIDE_MS = 800;

function ReelMedia({ item }: { item: MediaAsset }) {
  const style = mediaFocusStyle(item);
  if (item.kind === "video") {
    return (
      <video autoPlay muted loop playsInline poster={item.poster || undefined} style={style}>
        <source src={item.src} type={videoMime(item.src)} />
      </video>
    );
  }
  return <img src={item.src} alt={item.alt} loading="lazy" decoding="async" style={style} />;
}

export function BaptismReel({ items, title, interval = 3500 }: { items: MediaAsset[]; title: string; interval?: number }) {
  const photos = useMemo(() => items.filter((item) => item.src), [items]);
  const count = photos.length;
  const [pos, setPos] = useState(count);
  const [instant, setInstant] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || hovered || hidden) return;
    const id = window.setInterval(() => setPos((current) => current + 1), interval);
    return () => window.clearInterval(id);
  }, [count, hovered, hidden, interval]);

  useEffect(() => {
    if (count < 2 || (pos >= count && pos < count * 2)) return;
    const id = window.setTimeout(() => {
      setInstant(true);
      setPos(count + (((pos % count) + count) % count));
    }, SLIDE_MS + 40);
    return () => window.clearTimeout(id);
  }, [pos, count]);

  useEffect(() => {
    if (!instant) return;
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setInstant(false)));
    return () => window.cancelAnimationFrame(id);
  }, [instant]);

  if (count === 0) return null;

  const loop = count > 1 ? [...photos, ...photos, ...photos] : photos;
  const active = ((pos % count) + count) % count;

  return (
    <div
      className="baptism-reel"
      aria-roledescription="carrusel"
      aria-label={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="baptism-reel-viewport">
        <ul
          className="baptism-reel-track"
          data-instant={instant ? "true" : "false"}
          style={{ ["--reel-pos" as string]: count > 1 ? pos : 0, ["--reel-slide" as string]: `${SLIDE_MS}ms` }}
        >
          {loop.map((photo, index) => (
            <li
              key={`${photo.src}-${index}`}
              className="baptism-reel-card"
              data-active={count > 1 && index === pos ? "true" : "false"}
              aria-hidden={count > 1 && (index < count || index >= count * 2) ? true : undefined}
            >
              <ReelMedia item={photo} />
            </li>
          ))}
        </ul>
      </div>

      {count > 1 && (
        <div className="baptism-reel-controls">
          <button type="button" className="baptism-reel-arrow" aria-label="Foto anterior" onClick={() => setPos((current) => current - 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <div className="baptism-reel-dots" role="tablist" aria-label="Fotos de bautismo">
            {photos.map((photo, index) => (
              <button
                key={`${photo.src}-dot-${index}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Foto ${index + 1}`}
                className="baptism-reel-dot"
                data-on={index === active ? "true" : "false"}
                onClick={() => setPos(count + index)}
              />
            ))}
          </div>
          <button type="button" className="baptism-reel-arrow" aria-label="Foto siguiente" onClick={() => setPos((current) => current + 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

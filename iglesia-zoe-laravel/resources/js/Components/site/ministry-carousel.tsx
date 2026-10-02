import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MediaView } from "@/Components/site/media-view";
import { mediaChromeStyle, normalizeFit, parseRatio, type MediaAsset } from "@/lib/media";

const INTERVAL = 5000;

function thumbOf(asset: MediaAsset) {
  return asset.kind === "video" ? asset.poster : asset.src;
}

function captionOf(asset: MediaAsset, name: string) {
  const alt = asset.alt?.trim() ?? "";
  return alt && alt !== name && !/·\s*foto\s*\d+$/i.test(alt) ? alt : "";
}

export function MinistryCarousel({ assets, name }: { assets: MediaAsset[]; name: string }) {
  const slides = assets.filter((asset) => asset?.src);
  const total = slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const thumbs = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const strip = thumbs.current;
    const thumb = strip?.children[active] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    const left = thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  if (!total) return null;

  const first = slides[0];
  const box = parseRatio(first.ratio).css || "4 / 5";
  const current = slides[Math.min(active, total - 1)];
  const caption = captionOf(current, name);

  const go = (index: number) => setActive(((index % total) + total) % total);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(active + 1);
    if (event.key === "ArrowLeft") go(active - 1);
  };
  const onPointerDown = (event: PointerEvent) => {
    swipe.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (swipe.current === null) return;
    const delta = event.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(delta) > 40) go(active + (delta < 0 ? 1 : -1));
  };

  return (
    <div
      className="ministry-gallery"
      data-paused={paused || hidden || undefined}
      role="region"
      aria-roledescription="carrusel"
      aria-label={`Fotos de ${name}`}
      onPointerEnter={(event) => event.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setPaused(false)}
      onFocus={(event) => event.target.matches(":focus-visible") && setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="ministry-carousel shot relative w-full"
        style={{ ...mediaChromeStyle(first), aspectRatio: box, maxHeight: "min(60svh, 520px)" }}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        {slides.map((asset, index) => (
          <div
            key={`${asset.src}-${index}`}
            className="ministry-carousel-slide"
            data-active={index === active ? "true" : "false"}
            aria-hidden={index !== active}
          >
            <div className="ministry-carousel-zoom">
              <MediaView asset={asset} fit={normalizeFit(asset.fit) === "fit" ? "contain" : "cover"} />
            </div>
          </div>
        ))}

        <div className="ministry-stage-meta">
          <span className="ministry-stage-pill">{name}</span>
          {caption ? <p key={active} className="ministry-stage-caption">{caption}</p> : null}
        </div>

        {total > 1 ? (
          <>
            <span className="ministry-stage-count" aria-live="polite">
              {String(active + 1).padStart(2, "0")}
              <i> / {String(total).padStart(2, "0")}</i>
            </span>
            <div className="ministry-stage-arrows">
              <button type="button" onClick={() => go(active - 1)} aria-label="Foto anterior">←</button>
              <button type="button" onClick={() => go(active + 1)} aria-label="Foto siguiente">→</button>
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div ref={thumbs} className="ministry-thumbs" style={{ ["--thumbs" as string]: Math.min(total, 4) }}>
          {slides.map((asset, index) => {
            const src = thumbOf(asset);
            return (
              <button
                key={`${asset.src}-${index}`}
                type="button"
                className="ministry-thumb"
                data-active={index === active || undefined}
                aria-label={`Ver foto ${index + 1} de ${total}`}
                aria-current={index === active || undefined}
                onClick={() => go(index)}
              >
                {src ? (
                  <img src={src} alt="" loading="lazy" draggable={false} style={{ objectPosition: `${asset.posX ?? 50}% ${asset.posY ?? 50}%` }} />
                ) : (
                  <span className="ministry-thumb-video" aria-hidden>▶</span>
                )}
                <span className="ministry-thumb-bar" style={{ animationDuration: `${INTERVAL}ms` }} onAnimationEnd={() => index === active && go(active + 1)} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

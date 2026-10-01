import { useEffect, useState, type KeyboardEvent } from "react";
import { MediaView } from "@/Components/site/media-view";
import { mediaChromeStyle, normalizeFit, parseRatio, type MediaAsset } from "@/lib/media";

const INTERVAL = 5000;

export function MinistryCarousel({ assets, name }: { assets: MediaAsset[]; name: string }) {
  const slides = assets.filter((asset) => asset?.src);
  const total = slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (total < 2 || paused) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % total), INTERVAL);
    return () => window.clearTimeout(timer);
  }, [active, paused, total]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!total) return null;

  const first = slides[0];
  const ratio = parseRatio(first.ratio);
  const box = ratio.css || "4 / 5";

  const go = (index: number) => setActive(((index % total) + total) % total);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(active + 1);
    if (event.key === "ArrowLeft") go(active - 1);
  };

  return (
    <div
      className="ministry-carousel shot relative w-full"
      style={{ ...mediaChromeStyle(first), aspectRatio: box, maxHeight: "min(68svh, 560px)" }}
      role="region"
      aria-roledescription="carrusel"
      aria-label={`Fotos de ${name}`}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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

      {total > 1 && (
        <div className="ministry-carousel-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              className="ministry-carousel-dot"
              data-active={index === active ? "true" : "false"}
              aria-label={`Ver foto ${index + 1} de ${total}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => go(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

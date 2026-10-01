import { useEffect, useMemo, useRef, useState } from "react";
import { mediaFocusStyle, videoMime, type MediaAsset } from "@/lib/media";

function SlideMedia({ item, eager }: { item: MediaAsset; eager: boolean }) {
  const style = mediaFocusStyle(item);
  if (item.kind === "video") {
    return (
      <video className="about-slide-media" style={style} autoPlay muted loop playsInline poster={item.poster || undefined}>
        <source src={item.src} type={videoMime(item.src)} />
      </video>
    );
  }
  return (
    <img
      className="about-slide-media"
      style={style}
      src={item.src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
    />
  );
}

export function AboutSlides({
  items,
  label,
  interval = 4000,
  aside,
  children,
}: {
  items: MediaAsset[];
  label: string;
  interval?: number;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const photos = useMemo(() => items.filter((item) => item.src), [items]);
  const count = photos.length;
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [cueReady, setCueReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setCueReady(true), 5000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = section.getBoundingClientRect();
      const progress = Math.min(Math.max(-top / ((height || 1) * 0.8), 0), 1);
      section.style.setProperty("--about-fade", (1 - progress).toFixed(3));
      section.dataset.gone = progress > 0.96 ? "true" : "false";
      setScrolled(progress > 0.02);
    };
    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, []);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || hidden) return;
    const id = window.setTimeout(() => setActive((current) => (current + 1) % count), interval);
    return () => window.clearTimeout(id);
  }, [active, cycle, count, hidden, interval]);

  const go = (index: number) => {
    setActive(((index % count) + count) % count);
    setCycle((value) => value + 1);
  };

  const scrollPast = () => {
    const section = sectionRef.current;
    if (!section) return;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: section.getBoundingClientRect().bottom + window.scrollY - header,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <section
      ref={sectionRef}
      className="hero-bleed about-slides"
      aria-roledescription="carrusel"
      aria-label={label}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchX.current === null || count < 2) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(delta) > 48) go(active + (delta < 0 ? 1 : -1));
      }}
    >
      <div className="about-slides-stage" aria-hidden="true">
        {photos.map((photo, index) => (
          <div key={`${photo.src}-${index}`} className="about-slide" data-on={index === active ? "true" : "false"}>
            <SlideMedia item={photo} eager={index === 0} />
          </div>
        ))}
      </div>
      <div className="about-slides-shade" aria-hidden="true" />

      {count > 1 && (
        <>
          <button type="button" className="about-slides-arrow" data-side="prev" aria-label="Foto anterior" onClick={() => go(active - 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className="about-slides-arrow" data-side="next" aria-label="Foto siguiente" onClick={() => go(active + 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div className="about-slides-copy">
        <div className="about-slides-main">{children}</div>
        {aside && <div className="about-slides-aside">{aside}</div>}
      </div>

      {count > 1 && (
        <div className="about-slides-dots" role="tablist" aria-label="Fotos de la iglesia">
          {photos.map((photo, index) => (
            <button
              key={`${photo.src}-dot-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Foto ${index + 1} de ${count}`}
              className="about-slides-dot"
              data-on={index === active ? "true" : "false"}
              onClick={() => go(index)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="about-slides-cue"
        data-on={cueReady && !scrolled ? "true" : "false"}
        tabIndex={cueReady && !scrolled ? 0 : -1}
        aria-label="Desliza hacia abajo"
        onClick={scrollPast}
      >
        <span className="about-slides-cue-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path className="about-slides-cue-stem" d="M12 3v28" pathLength={1} />
            <path className="about-slides-cue-head" d="M5 24l7 7 7-7" />
          </svg>
        </span>
      </button>
    </section>
  );
}

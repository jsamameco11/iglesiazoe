"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Rise } from "@/components/motion/rise";
import { videoMime, type MediaAsset } from "@/lib/media";

const start = 2;

function wrap(value: number, length: number) {
  return ((value % length) + length) % length;
}

function shortestOffset(index: number, active: number, length: number) {
  let offset = index - active;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
}

function RailControl({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const next = direction === "next";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={next ? "Ver la siguiente imagen" : "Ver la imagen anterior"}
      className={`group absolute top-1/2 z-40 flex h-10 w-10 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#8d8d8d] ring-1 ring-black/8 transition hover:text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:h-11 sm:w-11 ${next ? "right-1 sm:right-2" : "left-1 sm:left-2"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {next ? <path d="M9 5l7 7-7 7" /> : <path d="M15 5l-7 7 7 7" />}
      </svg>
    </button>
  );
}

function RailMedia({ item }: { item: MediaAsset }) {
  if (item.kind === "video") {
    return (
      <video className="pointer-events-none" autoPlay muted loop playsInline poster={item.poster || undefined}>
        <source src={item.src} type={videoMime(item.src)} />
      </video>
    );
  }
  return <img src={item.src} alt="" />;
}

export function PhotoRail({ title, text, items }: { title: string; text: string; items: MediaAsset[] }) {
  const photos = useMemo(() => items.filter((item) => item.src), [items]);
  const initial = Math.min(start, Math.max(0, photos.length - 1));
  const [active, setActive] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tick, setTick] = useState(0);
  const prevOffsets = useRef(photos.map((_, index) => shortestOffset(index, initial, photos.length)));

  const offsets = photos.map((_, index) => shortestOffset(index, active, photos.length));
  const jumps = offsets.map((offset, index) => Math.abs(offset - (prevOffsets.current[index] ?? offset)) > 2);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const nextOffsets = photos.map((_, index) => shortestOffset(index, active, photos.length));
    const moved = nextOffsets.some((offset, index) => Math.abs(offset - (prevOffsets.current[index] ?? offset)) > 2);
    prevOffsets.current = nextOffsets;
    if (!moved) return;
    const id = window.requestAnimationFrame(() => setTick((value) => value + 1));
    return () => window.cancelAnimationFrame(id);
  }, [active, photos]);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setActive((current) => wrap(current + 1, photos.length));
    }, 3000);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, active, photos.length]);

  const go = (direction: number) => {
    setActive((current) => wrap(current + direction, photos.length));
  };

  if (photos.length === 0) return null;

  return (
    <Rise>
      <section
        className="flex w-full max-w-[100vw] flex-col justify-center overflow-hidden px-4 py-20 sm:px-8 md:px-12"
        aria-roledescription="carrusel"
        aria-label={title}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
        }}
      >
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="editorial lead text-[2.4rem] leading-[1.08] sm:text-5xl md:text-6xl lg:text-[4.4rem]">
            Somos una iglesia
            <br />
            que <span className="ital ink">está en</span>
            <br />
            <span className="ital ink">movimiento</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] font-light leading-7 text-muted">{text}</p>
        </div>

        <div className="relative mx-auto mt-14 w-full max-w-6xl overflow-hidden sm:mt-16">
          <RailControl direction="prev" onClick={() => go(-1)} />
          <div className="photo-rail-stage" data-tick={tick}>
            {photos.map((photo, index) => {
              const offset = Math.max(-3, Math.min(3, offsets[index]));
              const featured = offset === 0;
              return (
                <button
                  key={`${photo.src}-${index}`}
                  type="button"
                  data-offset={offset}
                  data-jump={jumps[index] ? "true" : "false"}
                  aria-label={featured ? photo.alt : `Ver ${photo.alt}`}
                  aria-current={featured ? "true" : undefined}
                  onClick={() => {
                    if (!featured) setActive(index);
                  }}
                  className="photo-rail-card"
                >
                  <RailMedia item={photo} />
                </button>
              );
            })}
          </div>
          <RailControl direction="next" onClick={() => go(1)} />
        </div>
      </section>
    </Rise>
  );
}

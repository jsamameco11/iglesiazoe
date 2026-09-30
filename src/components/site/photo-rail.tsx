"use client";

import { useEffect, useRef, useState } from "react";
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
      className="group relative z-40 flex h-11 w-11 shrink-0 scale-90 items-center justify-center rounded-full bg-white text-[#8d8d8d] ring-1 ring-black/8 transition hover:text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:h-12 sm:w-12"
    >
      <span
        aria-hidden
        className={`select-none text-[1.65rem] font-light leading-none transition group-hover:scale-110 ${next ? "translate-x-px" : "-translate-x-px"}`}
      >
        {next ? "›" : "‹"}
      </span>
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
  const [active, setActive] = useState(start);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tick, setTick] = useState(0);
  const prevOffsets = useRef(items.map((_, index) => shortestOffset(index, start, items.length)));

  const offsets = items.map((_, index) => shortestOffset(index, active, items.length));
  const jumps = offsets.map((offset, index) => Math.abs(offset - prevOffsets.current[index]) > 2);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const nextOffsets = items.map((_, index) => shortestOffset(index, active, items.length));
    const moved = nextOffsets.some((offset, index) => Math.abs(offset - prevOffsets.current[index]) > 2);
    prevOffsets.current = nextOffsets;
    if (!moved) return;
    const id = window.requestAnimationFrame(() => setTick((value) => value + 1));
    return () => window.cancelAnimationFrame(id);
  }, [active, items]);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setActive((current) => wrap(current + 1, items.length));
    }, 3000);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, active, items.length]);

  const go = (direction: number) => {
    setActive((current) => wrap(current + direction, items.length));
  };

  return (
    <Rise>
      <section
        className="flex min-h-[88svh] w-full flex-col justify-center px-4 py-20 sm:px-8 md:px-12"
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

        <div className="mt-14 flex w-full items-center gap-3 sm:mt-16 sm:gap-5 md:gap-8">
          <RailControl direction="prev" onClick={() => go(-1)} />
          <div className="photo-rail-stage min-w-0 flex-1" data-tick={tick}>
            {items.map((photo, index) => {
              const offset = offsets[index];
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

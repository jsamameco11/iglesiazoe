"use client";

import { useRef } from "react";
import { useScrollProgress } from "./use-scroll-progress";

type Tile = {
  src: string;
  alt: string;
  cutout?: boolean;
};

const layouts = [
  [
    { x: -18, y: 8, r: -8, s: 0.92, w: 38, h: 58, z: 2 },
    { x: 8, y: -10, r: 6, s: 1.08, w: 42, h: 64, z: 4 },
    { x: 28, y: 18, r: -4, s: 0.86, w: 30, h: 46, z: 3 },
    { x: -8, y: 22, r: 5, s: 0.78, w: 26, h: 40, z: 5 },
  ],
  [
    { x: -36, y: 4, r: 0, s: 1, w: 28, h: 52, z: 1 },
    { x: -8, y: 0, r: 0, s: 1, w: 34, h: 64, z: 3 },
    { x: 22, y: 8, r: 0, s: 1, w: 26, h: 48, z: 2 },
    { x: 42, y: 16, r: 0, s: 1, w: 22, h: 40, z: 1 },
  ],
  [
    { x: -6, y: 0, r: 0, s: 1, w: 54, h: 72, z: 2 },
    { x: 38, y: -16, r: 0, s: 1, w: 24, h: 32, z: 3 },
    { x: 38, y: 18, r: 0, s: 1, w: 24, h: 32, z: 3 },
    { x: -38, y: 18, r: 0, s: 1, w: 22, h: 34, z: 1 },
  ],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(from: (typeof layouts)[number][number], to: (typeof layouts)[number][number], t: number) {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    r: lerp(from.r, to.r, t),
    s: lerp(from.s, to.s, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
    z: Math.round(lerp(from.z, to.z, t)),
  };
}

export function MosaicStage({ tiles, caption }: { tiles: Tile[]; caption: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const scaled = Math.min(Math.max(progress, 0), 0.999);
  const segment = scaled * (layouts.length - 1);
  const index = Math.floor(segment);
  const t = segment - index;
  const from = layouts[index];
  const to = layouts[Math.min(index + 1, layouts.length - 1)];

  return (
    <div ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden">
        <div className="relative mx-auto h-[78svh] w-full max-w-[1200px]">
          {tiles.slice(0, 4).map((tile, i) => {
            const pose = mix(from[i], to[i], t);
            return (
              <figure
                key={tile.src}
                className={`absolute left-1/2 top-1/2 will-change-transform ${tile.cutout ? "isolate" : "overflow-hidden rounded-[1.6rem]"}`}
                style={{
                  width: `${pose.w}%`,
                  height: `${pose.h}%`,
                  zIndex: pose.z,
                  transform: `translate(-50%, -50%) translate(${pose.x}%, ${pose.y}%) rotate(${pose.r}deg) scale(${pose.s})`,
                  background: tile.cutout ? "transparent" : "#d7d2c8",
                }}
              >
                <img
                  src={tile.src}
                  alt={tile.alt}
                  className={`h-full w-full ${tile.cutout ? "cutout-blend object-contain object-bottom" : "object-cover"}`}
                />
              </figure>
            );
          })}
        </div>
        <p className="pointer-events-none absolute bottom-10 left-0 right-0 text-center text-[11px] uppercase tracking-[0.28em] text-muted">
          {caption}
        </p>
      </div>
    </div>
  );
}


import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { videoMime, type MediaAsset } from "@/lib/media";

const start = 2;

const DEFAULT_TITLE = "Somos una iglesia que está en movimiento";

const slots = {
  wide: {
    [-3]: { x: "-20%", w: "14%", o: 0, z: 0 },
    [-2]: { x: "9%", w: "14.5%", o: 1, z: 2 },
    [-1]: { x: "27%", w: "17%", o: 1, z: 3 },
    [0]: { x: "50%", w: "44%", o: 1, z: 6 },
    [1]: { x: "73%", w: "17%", o: 1, z: 3 },
    [2]: { x: "91%", w: "14.5%", o: 1, z: 2 },
    [3]: { x: "120%", w: "14%", o: 0, z: 0 },
  },
  narrow: {
    [-3]: { x: "-30%", w: "26%", o: 0, z: 0 },
    [-2]: { x: "-18%", w: "26%", o: 0, z: 1 },
    [-1]: { x: "16%", w: "29%", o: 1, z: 3 },
    [0]: { x: "50%", w: "58%", o: 1, z: 6 },
    [1]: { x: "84%", w: "29%", o: 1, z: 3 },
    [2]: { x: "118%", w: "26%", o: 0, z: 1 },
    [3]: { x: "130%", w: "26%", o: 0, z: 0 },
  },
} as const;

function wrap(value: number, length: number) {
  return ((value % length) + length) % length;
}

function shortestOffset(index: number, active: number, length: number) {
  let offset = index - active;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
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

export function PhotoRail({
  title,
  text,
  items,
  bare = false,
  interval = 4000,
  className = "",
}: {
  title: string;
  text?: string;
  items: MediaAsset[];
  bare?: boolean;
  interval?: number;
  className?: string;
}) {
  const photos = useMemo(() => items.filter((item) => item.src), [items]);
  const initial = Math.min(start, Math.max(0, photos.length - 1));
  const [active, setActive] = useState(initial);
  const [wide, setWide] = useState(true);
  const [jumps, setJumps] = useState<boolean[]>([]);
  const prevOffsets = useRef(photos.map((_, index) => shortestOffset(index, initial, photos.length)));

  const offsets = photos.map((_, index) => shortestOffset(index, active, photos.length));

  useLayoutEffect(() => {
    const nextOffsets = photos.map((_, index) => shortestOffset(index, active, photos.length));
    const wrapped = nextOffsets.map(
      (offset, index) => Math.abs(offset - (prevOffsets.current[index] ?? offset)) > 2,
    );
    prevOffsets.current = nextOffsets;
    if (!wrapped.some(Boolean)) return;
    setJumps(wrapped);
    const id = window.setTimeout(() => setJumps([]), 40);
    return () => window.clearTimeout(id);
  }, [active, photos]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = window.setInterval(() => {
      setActive((current) => wrap(current - 1, photos.length));
    }, interval);
    return () => window.clearInterval(id);
  }, [photos.length, interval]);

  if (photos.length === 0) return null;

  return (
    <section
      className={`flex w-full max-w-[100vw] flex-col justify-center overflow-hidden ${bare ? "about-photo-rail px-4 py-2 sm:px-8 md:px-12" : "px-4 pb-14 pt-9 sm:px-8 md:px-12 md:pb-16 md:pt-10"} ${className}`.trim()}
      aria-roledescription="carrusel"
      aria-label={title}
    >
      {!bare ? (
        <Rise>
          <div className="mx-auto max-w-3xl px-4 text-center">
            {title.trim() === DEFAULT_TITLE ? (
              <h2 className="editorial lead text-[2.4rem] leading-[1.08] sm:text-5xl md:text-6xl lg:text-[4.4rem]">
                Somos una iglesia
                <br />
                que <span className="ital ink">está en</span>
                <br />
                <span className="ital ink">movimiento</span>
              </h2>
            ) : (
              <LeadTitle as="h2" text={title} className="text-[2.4rem] leading-[1.08] sm:text-5xl md:text-6xl lg:text-[4.4rem]" />
            )}
            <p className="mx-auto mt-6 max-w-lg text-[15px] font-light leading-7 text-muted">{text}</p>
          </div>
        </Rise>
      ) : null}

      <div className={`relative mx-auto w-full max-w-6xl ${bare ? "mt-0" : "mt-4 sm:mt-5"}`}>
        <div className="photo-rail-stage">
          {photos.map((photo, index) => {
            const offset = Math.max(-3, Math.min(3, offsets[index])) as keyof typeof slots.wide;
            const featured = offset === 0;
            const slot = (wide ? slots.wide : slots.narrow)[offset];
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
                style={{
                  left: slot.x,
                  width: slot.w,
                  zIndex: slot.z,
                  opacity: slot.o,
                  pointerEvents: slot.o === 0 ? "none" : "auto",
                }}
              >
                <RailMedia item={photo} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

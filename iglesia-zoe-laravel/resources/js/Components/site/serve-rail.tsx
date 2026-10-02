import { Link, router } from "@inertiajs/react";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { splitEmphasis, useCopy } from "@/lib/copy";
import type { ServeArea } from "@/lib/types";

export const SERVE_FALLBACK = "/images/banner8.jpg";

export function photoFallback(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (!img.src.endsWith(SERVE_FALLBACK)) img.src = SERVE_FALLBACK;
}

/** Centres and widths in % of the stage; neighbours keep a clear gap so the five visible photos never overlap. */
const slots = {
  wide: {
    [-3]: { x: "-12%", w: "17%", o: 0, z: 0 },
    [-2]: { x: "8.8%", w: "17%", o: 1, z: 2 },
    [-1]: { x: "27.4%", w: "17%", o: 1, z: 3 },
    [0]: { x: "50%", w: "25%", o: 1, z: 6 },
    [1]: { x: "72.6%", w: "17%", o: 1, z: 3 },
    [2]: { x: "91.2%", w: "17%", o: 1, z: 2 },
    [3]: { x: "112%", w: "17%", o: 0, z: 0 },
  },
  narrow: {
    [-3]: { x: "-46%", w: "30%", o: 0, z: 0 },
    [-2]: { x: "-26%", w: "30%", o: 0, z: 1 },
    [-1]: { x: "8%", w: "30%", o: 1, z: 3 },
    [0]: { x: "50%", w: "50%", o: 1, z: 6 },
    [1]: { x: "92%", w: "30%", o: 1, z: 3 },
    [2]: { x: "126%", w: "30%", o: 0, z: 1 },
    [3]: { x: "146%", w: "30%", o: 0, z: 0 },
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

function RailTitle({ text }: { text: string }) {
  const parts = splitEmphasis(text);
  if (!parts.some((part) => part.em)) {
    return <LeadTitle as="h2" text={text} className="serve-rail-title" />;
  }
  return (
    <h2 className="editorial lead serve-rail-title">
      {parts.map((part, index) => (part.em ? <span key={index} className="ital ink">{part.text}</span> : <span key={index}>{part.text}</span>))}
    </h2>
  );
}

/** «Somos una iglesia que está en movimiento»: one photo per área de servicio, the active one raised with its button below. */
export function ServeRail({ title, text, areas, interval = 5000 }: { title: string; text?: string; areas: ServeArea[]; interval?: number }) {
  const t = useCopy();
  const [active, setActive] = useState(0);
  const [wide, setWide] = useState(true);
  const [paused, setPaused] = useState(false);
  const [jumps, setJumps] = useState<boolean[]>([]);
  const prevOffsets = useRef(areas.map((_, index) => shortestOffset(index, 0, areas.length)));
  const swipe = useRef<number | null>(null);
  const count = areas.length;
  const current = areas[Math.min(active, count - 1)];

  const go = (step: number) => setActive((value) => wrap(value + step, count));

  useLayoutEffect(() => {
    const next = areas.map((_, index) => shortestOffset(index, active, count));
    const wrapped = next.map((offset, index) => Math.abs(offset - (prevOffsets.current[index] ?? offset)) > 2);
    prevOffsets.current = next;
    if (!wrapped.some(Boolean)) return;
    setJumps(wrapped);
    const id = window.setTimeout(() => setJumps([]), 40);
    return () => window.clearTimeout(id);
  }, [active, areas, count]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => {
      if (document.visibilityState === "visible") go(1);
    }, interval);
    return () => window.clearTimeout(id);
  }, [active, paused, count, interval]);

  if (!current) return null;

  function onPointerDown(event: PointerEvent) {
    swipe.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent) {
    if (swipe.current === null) return;
    const dx = event.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  }

  const href = `/involucrate/${current.slug}`;

  return (
    <section
      className="serve-rail"
      aria-roledescription="carrusel"
      aria-label={title.replace(/\*/g, "")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setPaused(false)}
    >
      <Rise>
        <div className="mx-auto max-w-4xl px-4 text-center">
          <RailTitle text={title} />
          {text ? <p className="serve-rail-text">{text}</p> : null}
        </div>
      </Rise>

      <div className="serve-rail-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
        {areas.map((area, index) => {
          const offset = Math.max(-3, Math.min(3, shortestOffset(index, active, count))) as keyof typeof slots.wide;
          const featured = offset === 0;
          const slot = (wide ? slots.wide : slots.narrow)[offset];
          return (
            <button
              key={area.id}
              type="button"
              data-offset={offset}
              data-jump={jumps[index] ? "true" : "false"}
              aria-label={featured ? area.name : `Ver ${area.name}`}
              aria-current={featured ? "true" : undefined}
              tabIndex={slot.o === 0 ? -1 : undefined}
              onClick={() => (featured ? router.visit(`/involucrate/${area.slug}`) : setActive(index))}
              className="serve-rail-card"
              style={{ left: slot.x, width: slot.w, zIndex: slot.z, opacity: slot.o, pointerEvents: slot.o === 0 ? "none" : "auto" }}
            >
              <img src={area.image || SERVE_FALLBACK} alt="" loading="lazy" draggable={false} onError={photoFallback} />
            </button>
          );
        })}
      </div>

      <div className="serve-rail-caption" aria-live="polite">
        <div key={current.id} className="serve-rail-caption-in">
          <Link href={href} className="serve-rail-pill">{current.name}</Link>
          {current.tagline ? <p className="serve-rail-tagline">{current.tagline}</p> : null}
        </div>
        {count > 1 ? (
          <div className="serve-rail-arrows">
            <button type="button" onClick={() => go(-1)} aria-label={t("serve.prev")}>←</button>
            <button type="button" onClick={() => go(1)} aria-label={t("serve.next")}>→</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export const SLIDE_INTERVAL = 5000;

/**
 * Active slide with autoplay that waits while the visitor looks (hover, keyboard focus) or the tab is hidden.
 * With reduced motion the photos still take turns, only slower and with a plain fade.
 */
export function useSlideshow(total: number, interval = SLIDE_INTERVAL) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [calm, setCalm] = useState(false);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setCalm(motion.matches);
    onMotion();
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotion);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  const go = useCallback((index: number) => setActive(total ? ((index % total) + total) % total : 0), [total]);

  useEffect(() => {
    if (total < 2 || paused || hidden) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % total), calm ? interval * 1.6 : interval);
    return () => window.clearTimeout(timer);
  }, [active, total, paused, hidden, calm, interval]);

  const current = total ? Math.min(active, total - 1) : 0;

  return {
    active: current,
    go,
    root: {
      onPointerEnter: (event: PointerEvent) => event.pointerType === "mouse" && setPaused(true),
      onPointerLeave: (event: PointerEvent) => event.pointerType === "mouse" && setPaused(false),
      onFocus: (event: FocusEvent) => (event.target as HTMLElement).matches(":focus-visible") && setPaused(true),
      onBlur: () => setPaused(false),
    },
    stage: {
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowRight") go(current + 1);
        if (event.key === "ArrowLeft") go(current - 1);
      },
      onPointerDown: (event: PointerEvent) => {
        swipe.current = event.clientX;
      },
      onPointerUp: (event: PointerEvent) => {
        if (swipe.current === null) return;
        const delta = event.clientX - swipe.current;
        swipe.current = null;
        if (Math.abs(delta) > 40) go(current + (delta < 0 ? 1 : -1));
      },
      onPointerCancel: () => {
        swipe.current = null;
      },
    },
  };
}

function Chevron({ side }: { side: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={side === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export function SlideDots({ total, active, onPick, className = "" }: { total: number; active: number; onPick: (index: number) => void; className?: string }) {
  return (
    <div className={`slides-dots ${className}`.trim()}>
      {Array.from({ length: total }, (_, index) => (
        <button
          key={index}
          type="button"
          className="slides-dot"
          data-active={index === active || undefined}
          aria-label={`Ver foto ${index + 1} de ${total}`}
          aria-current={index === active || undefined}
          onClick={() => onPick(index)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}

/**
 * Carousel of a slot's photos: arrows beside the photo and bars below ("framed"),
 * or over the photo when it fills its box ("fill").
 */
export function Slideshow({
  count,
  label,
  variant = "framed",
  className = "",
  stageClassName = "",
  stageStyle,
  children,
}: {
  count: number;
  label: string;
  variant?: "framed" | "fill";
  className?: string;
  stageClassName?: string;
  stageStyle?: CSSProperties;
  children: (index: number) => ReactNode;
}) {
  const { active, go, root, stage } = useSlideshow(count);

  const arrow = (side: "prev" | "next") => (
    <button type="button" className="slides-arrow" data-side={side} aria-label={side === "prev" ? "Foto anterior" : "Foto siguiente"} onClick={() => go(active + (side === "prev" ? -1 : 1))}>
      <Chevron side={side} />
    </button>
  );

  const stageNode = (
    <div className={`slides-stage ${stageClassName}`.trim()} style={stageStyle} tabIndex={0} {...stage}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="slides-layer" data-active={index === active || undefined} aria-hidden={index !== active}>
          {children(index)}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`slides slides-${variant} ${className}`.trim()} role="region" aria-roledescription="carrusel" aria-label={label} {...root}>
      {variant === "framed" ? (
        <div className="slides-row">
          {arrow("prev")}
          {stageNode}
          {arrow("next")}
        </div>
      ) : (
        <>
          {stageNode}
          {arrow("prev")}
          {arrow("next")}
        </>
      )}
      <SlideDots total={count} active={active} onPick={go} />
    </div>
  );
}

import { Link } from "@inertiajs/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Rise } from "@/Components/motion/rise";
import { MediaView } from "@/Components/site/media-view";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry } from "@/lib/types";

/** Phones (one column) show a single card that rotates; wider screens keep the grid. */
const PHONE = "(max-width: 639px)";

export function MinistryCards({
  ministries,
  media,
  className = "",
  rotate = false,
  interval = 3000,
}: {
  ministries: Ministry[];
  media: ResolvedMedia;
  className?: string;
  /** On phones, one card at a time that passes to the next every `interval` ms. */
  rotate?: boolean;
  interval?: number;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipe = useRef<number | null>(null);
  const count = ministries.length;
  const rotating = rotate && count > 1;

  const go = (step: number) => setActive((value) => (value + step + count) % count);

  useEffect(() => {
    if (!rotating || paused) return;
    const phone = window.matchMedia(PHONE);
    const id = window.setInterval(() => {
      if (phone.matches && document.visibilityState === "visible") go(1);
    }, interval);
    return () => window.clearInterval(id);
  }, [rotating, paused, active, count, interval]);

  if (!count) return null;

  function onPointerDown(event: PointerEvent) {
    swipe.current = event.clientX;
    setPaused(true);
  }

  function onPointerUp(event: PointerEvent) {
    setPaused(false);
    if (swipe.current === null) return;
    const dx = event.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  }

  return (
    <div className={className}>
      <div
        className="ministry-cards"
        data-rotate={rotating ? "true" : undefined}
        onPointerDown={rotating ? onPointerDown : undefined}
        onPointerUp={rotating ? onPointerUp : undefined}
        onPointerCancel={
          rotating
            ? () => {
                swipe.current = null;
                setPaused(false);
              }
            : undefined
        }
      >
        {ministries.map((ministry, index) => (
          <Rise key={ministry.slug} delay={rotating ? 0 : index * 120} data-active={rotating ? String(index === active) : undefined}>
            <Link href={`/ministerios/${ministry.slug}`} draggable={false} className="ministry-photo group aspect-[3/4] w-full rounded-[1.6rem]">
              <MediaView asset={media.ministry(ministry.slug, ministry.name)} fit="cover" />
              <span className="ministry-shade" />
              <span className="ministry-copy">
                <span className="ministry-age">{ministry.age_range}</span>
                <span className="ministry-name">{ministry.name}</span>
                {ministry.summary ? <span className="ministry-summary">{ministry.summary}</span> : null}
              </span>
            </Link>
          </Rise>
        ))}
      </div>
      {rotating ? (
        <div className="ministry-dots" data-paused={paused ? "true" : undefined} style={{ "--ministry-interval": `${interval}ms` } as React.CSSProperties}>
          {ministries.map((ministry, index) => (
            <button
              key={ministry.slug}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Ver ${ministry.name}`}
              aria-current={index === active ? "true" : undefined}
              className="ministry-dot"
            >
              {index === active ? <span key={active} className="ministry-dot-fill" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

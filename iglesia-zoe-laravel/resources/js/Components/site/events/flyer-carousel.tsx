import { useEffect, useRef, useState } from "react";
import { Chevron } from "@/Components/site/events/event-calendar";
import { MediaView } from "@/Components/site/media-view";
import { useCopy } from "@/lib/copy";
import { downloadEventIcs, eventDateLabel } from "@/lib/events";
import type { MediaAsset } from "@/lib/media";
import type { ChurchEvent } from "@/lib/types";

const INTERVAL = 6500;

/** The flyers of the month on the calendar, one at a time, with arrows, dots and the details of the one on screen. */
export function FlyerCarousel({
  events,
  index,
  fallback,
  autoplay,
  onIndex,
}: {
  events: ChurchEvent[];
  index: number;
  fallback: MediaAsset;
  autoplay: boolean;
  onIndex: (index: number, byUser: boolean) => void;
}) {
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const total = events.length;
  const go = (next: number) => onIndex((next + total) % total, true);

  useEffect(() => {
    if (!autoplay || total < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => onIndex((index + 1) % total, false), INTERVAL);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, paused, total, onIndex]);

  if (!total) return null;

  return (
    <div
      className="flyer-carousel"
      data-reveal="off"
      aria-roledescription="carrusel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flyer-stage">
        {total > 1 && (
          <button type="button" className="flyer-arrow" data-side="prev" onClick={() => go(index - 1)} aria-label="Flyer anterior">
            <Chevron back />
          </button>
        )}
        <div
          className="flyer-frame"
          onTouchStart={(event) => (touch.current = event.touches[0].clientX)}
          onTouchEnd={(event) => {
            if (touch.current === null) return;
            const dx = event.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 50 && total > 1) go(index + (dx < 0 ? 1 : -1));
          }}
        >
          {events.map((event, i) => (
            <figure key={event.id} className="flyer-slide" data-active={i === index || undefined} aria-hidden={i !== index} aria-label={`${i + 1} de ${total}`}>
              {event.image ? (
                <>
                  <img className="flyer-blur" src={event.image} alt="" aria-hidden loading="lazy" />
                  <img className="flyer-image" src={event.image} alt={event.title} loading={i === index ? "eager" : "lazy"} />
                </>
              ) : (
                <MediaView asset={fallback} fit="cover" className="flyer-fallback" />
              )}
            </figure>
          ))}
        </div>
        {total > 1 && (
          <button type="button" className="flyer-arrow" data-side="next" onClick={() => go(index + 1)} aria-label="Flyer siguiente">
            <Chevron />
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="flyer-dots">
          {events.map((event, i) => (
            <button key={event.id} type="button" className="flyer-dot" data-active={i === index || undefined} onClick={() => go(i)} aria-label={`Ver ${event.title}`} aria-current={i === index || undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Title, date, place and actions of the flyer on screen, with the button that adds it to the visitor's calendar. */
export function FlyerDetails({ event }: { event: ChurchEvent }) {
  const t = useCopy();
  const when = [eventDateLabel(event.starts_on, event.ends_on), event.time_label].filter(Boolean).join(" · ");

  return (
    <div className="flyer-info" aria-live="polite">
      <p className="flyer-ask">{t("events.schedule")}</p>
      <h3 className="flyer-title editorial">{event.title}</h3>
      <dl className="event-facts">
        <div>
          <dt>{t("events.when")}</dt>
          <dd className="first-letter:uppercase">{when}</dd>
        </div>
        {event.location ? (
          <div>
            <dt>{t("events.where")}</dt>
            <dd>{event.location}</dd>
          </div>
        ) : null}
      </dl>
      {event.summary ? <p className="flyer-summary">{event.summary}</p> : null}
      {event.body ? (
        <details key={event.id} className="flyer-body">
          <summary>{t("events.more")}</summary>
          {event.body
            .split(/\r?\n/)
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part, i) => (
              <p key={i}>{part}</p>
            ))}
        </details>
      ) : null}
      <div className="flyer-actions">
        <button type="button" className="flyer-schedule" onClick={() => downloadEventIcs(event, `${window.location.origin}/eventos?e=${event.id}`)}>
          <CalendarGlyph />
          {t("events.scheduleButton")}
        </button>
        {event.cta_url ? (
          <a href={event.cta_url} target={event.cta_url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="flyer-cta">
            {event.cta_label || t("events.more")} →
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v4M10 15.5h4" />
    </svg>
  );
}

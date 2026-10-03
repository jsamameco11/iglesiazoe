import { Link } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaView } from "@/Components/site/media-view";
import { useCopy } from "@/lib/copy";
import { eventBadge, eventDateLabel } from "@/lib/events";
import type { MediaAsset } from "@/lib/media";
import type { ChurchEvent } from "@/lib/types";
import { useSitePages } from "@/lib/site-pages";

const INTERVAL = 7000;

function EventArt({ event, fallback }: { event: ChurchEvent; fallback: MediaAsset }) {
  const badge = eventBadge(event.starts_on);
  return (
    <div className="event-art">
      {event.image ? (
        <>
          <img className="event-art-blur" src={event.image} alt="" aria-hidden loading="lazy" />
          <img className="event-art-main" src={event.image} alt={event.title} loading="lazy" />
        </>
      ) : (
        <MediaView asset={fallback} fit="cover" className="event-art-fallback" />
      )}
      <span className="event-date-chip" aria-hidden>
        <span className="event-date-day">{badge.day}</span>
        <span className="event-date-month">{badge.month}</span>
      </span>
    </div>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n|\r?\n/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part, index) => (
          <p key={index}>{part}</p>
        ))}
    </>
  );
}

export function EventSlider({
  events,
  fallback,
  compact = false,
  index: controlled,
  onIndex,
}: {
  events: ChurchEvent[];
  fallback: MediaAsset;
  compact?: boolean;
  index?: number;
  onIndex?: (index: number) => void;
}) {
  const pages = useSitePages();
  const t = useCopy();
  const [own, setOwn] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const total = events.length;
  const index = Math.min(controlled ?? own, Math.max(0, total - 1));

  const go = useCallback(
    (next: number) => {
      const value = (next + total) % total;
      setOwn(value);
      onIndex?.(value);
    },
    [total, onIndex],
  );

  useEffect(() => {
    if (total < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL);
    return () => window.clearTimeout(timer);
  }, [index, paused, total, go]);

  if (!total) return null;

  return (
    <div
      className={`event-slider ${compact ? "event-slider-compact" : ""}`}
      data-reveal="off"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => (touch.current = event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touch.current === null) return;
        const dx = event.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
      aria-roledescription="carrusel"
    >
      <div className="event-stage">
        {events.map((event, i) => {
          const active = i === index;
          const when = [eventDateLabel(event.starts_on, event.ends_on), event.time_label].filter(Boolean).join(" · ");
          return (
            <article key={event.id} className="event-slide" data-active={active || undefined} aria-hidden={!active} aria-label={`${i + 1} de ${total}`}>
              <EventArt event={event} fallback={fallback} />
              <div className="event-info">
                <p className="kicker">
                  {i === 0 ? t("events.next") : pages.kicker("events")}
                  {total > 1 ? <span className="event-count"> · {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span> : null}
                </p>
                <h3 className="event-title editorial">{event.title}</h3>
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
                {event.summary ? <p className="event-summary">{event.summary}</p> : null}
                {!compact && event.body ? (
                  <div className="event-body">
                    <Paragraphs text={event.body} />
                  </div>
                ) : null}
                <div className="event-actions">
                  {event.cta_url ? (
                    <a href={event.cta_url} target={event.cta_url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" tabIndex={active ? undefined : -1} className="btn-accent rounded-full px-5 py-2.5 text-sm font-semibold">
                      {event.cta_label || t("events.more")}
                    </a>
                  ) : null}
                  {compact ? (
                    <Link href={`/eventos?e=${event.id}`} tabIndex={active ? undefined : -1} className="home-link">
                      {t("events.more")} →
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {total > 1 ? (
        <div className="event-controls">
          <button type="button" className="event-arrow" onClick={() => go(index - 1)} aria-label="Evento anterior">
            ←
          </button>
          <div className="event-dots">
            {events.map((event, i) => (
              <button
                key={event.id}
                type="button"
                className="event-dot"
                data-active={i === index || undefined}
                data-paused={paused || undefined}
                onClick={() => go(i)}
                aria-label={`Ver ${event.title}`}
              >
                {i === index ? <span key={index} className="event-dot-fill" style={{ animationDuration: `${INTERVAL}ms` }} /> : null}
              </button>
            ))}
          </div>
          <button type="button" className="event-arrow" onClick={() => go(index + 1)} aria-label="Evento siguiente">
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}

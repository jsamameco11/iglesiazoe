import { useMemo } from "react";
import { eventDays, monthGrid, monthTitle } from "@/lib/events";
import type { ChurchEvent } from "@/lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Month calendar of /eventos: days with events stand out, today is marked and the event on screen lights its days. */
export function EventCalendar({
  title,
  month,
  today,
  events,
  activeId,
  canGoBack,
  canGoForward,
  onMonth,
  onPick,
}: {
  title: string;
  month: string;
  today: string;
  events: ChurchEvent[];
  activeId: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onMonth: (by: number) => void;
  onPick: (day: string) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, ChurchEvent[]>();
    for (const event of events) {
      for (const day of eventDays(event)) map.set(day, [...(map.get(day) ?? []), event]);
    }
    return map;
  }, [events]);
  const heading = monthTitle(month);

  return (
    <div className="event-calendar">
      <div className="event-calendar-head">
        <h2 className="event-calendar-title">
          <span className="sr-only">{title} · </span>
          {heading.month} <span>{heading.year}</span>
        </h2>
        <div className="event-calendar-nav">
          <button type="button" onClick={() => onMonth(-1)} disabled={!canGoBack} aria-label="Mes anterior">
            <Chevron back />
          </button>
          <button type="button" onClick={() => onMonth(1)} disabled={!canGoForward} aria-label="Mes siguiente">
            <Chevron />
          </button>
        </div>
      </div>

      <div className="event-calendar-grid">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="event-calendar-weekday">{weekday}</span>
        ))}
        {monthGrid(month).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} aria-hidden />;
          const found = byDay.get(day) ?? [];
          const finished = found.length > 0 && found.every((event) => (event.ends_on || event.starts_on) < today);
          const label = Number(day.slice(8));
          if (!found.length || finished) {
            return (
              <span key={day} className="event-calendar-day" data-today={day === today || undefined} data-finished={finished || undefined}>
                {label}
              </span>
            );
          }
          const titles = found.map((event) => event.title).join(" · ");
          return (
            <button
              key={day}
              type="button"
             
              className="event-calendar-day"
              data-event
              data-today={day === today || undefined}
              data-active={found.some((event) => event.id === activeId) || undefined}
              onClick={() => onPick(day)}
              aria-label={`${label}: ${titles}`}
            >
              {label}
              <span className="event-calendar-tip" aria-hidden>{titles}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

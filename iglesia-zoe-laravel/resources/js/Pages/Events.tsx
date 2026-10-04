import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { EventCalendar } from "@/Components/site/events/event-calendar";
import { FlyerCarousel, FlyerDetails } from "@/Components/site/events/flyer-carousel";
import { PastEvents } from "@/Components/site/events/past-events";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { eventDays, monthKey, shiftMonth } from "@/lib/events";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { ChurchEvent, PastEvent, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";
import "../../css/events.css";

/** How far ahead the calendar goes when no event is announced later than that. */
const MONTHS_AHEAD = 11;

/** First month an event shows on: today's month when it already started. */
function openingMonth(event: ChurchEvent, today: string) {
  return monthKey(event.starts_on < today ? today : event.starts_on);
}

export default function Events({
  events,
  pastEvents,
  today,
  settings,
  mediaOverrides,
  skin,
}: {
  events: ChurchEvent[];
  pastEvents: PastEvent[];
  today: string;
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const thisMonth = monthKey(today);
  const upcoming = useMemo(() => events.filter((event) => (event.ends_on || event.starts_on) >= today), [events, today]);
  const lastMonth = useMemo(() => {
    const latest = events.reduce((max, event) => (monthKey(event.ends_on || event.starts_on) > max ? monthKey(event.ends_on || event.starts_on) : max), thisMonth);
    const ahead = shiftMonth(thisMonth, MONTHS_AHEAD);
    return latest > ahead ? latest : ahead;
  }, [events, thisMonth]);

  const [month, setMonth] = useState(() => {
    const first = upcoming[0];
    return first ? openingMonth(first, today) : thisMonth;
  });
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const flyer = useRef<HTMLDivElement>(null);

  const monthEvents = useMemo(() => upcoming.filter((event) => eventDays(event).some((day) => day.startsWith(month))), [upcoming, month]);
  const current = monthEvents[Math.min(index, monthEvents.length - 1)] ?? null;
  const nextEvent = monthEvents.length ? null : upcoming.find((event) => openingMonth(event, today) > month) ?? null;

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("e");
    const event = wanted ? upcoming.find((item) => item.id === wanted) : undefined;
    if (!event) return;
    const opening = openingMonth(event, today);
    setMonth(opening);
    setIndex(Math.max(0, upcoming.filter((item) => eventDays(item).some((day) => day.startsWith(opening))).indexOf(event)));
    setAutoplay(false);
  }, [upcoming, today]);

  const showMonth = (next: string) => {
    setMonth(next);
    setIndex(0);
  };

  const pickDay = (day: string) => {
    const found = monthEvents.findIndex((event) => eventDays(event).includes(day));
    if (found < 0) return;
    setIndex(found);
    setAutoplay(false);
    if (window.matchMedia("(max-width: 1023px)").matches) flyer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const pickFlyer = useCallback((next: number, byUser: boolean) => {
    setIndex(next);
    if (byUser) setAutoplay(false);
  }, []);

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={pages.kicker("events")} title={settings.eventsTitle}>
            <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.eventsText}</p>
          </PageIntro>
        </Rise>

        <section {...section("calendar", "Calendario de eventos")} className="events-board mt-14 md:mt-20">
          <Rise className="events-board-calendar">
            <p className="kicker">{t("events.calendar")}</p>
            <EventCalendar
              title={t("events.calendar")}
              month={month}
              today={today}
              events={events}
              activeId={current?.id ?? null}
              canGoBack={month > thisMonth}
              canGoForward={month < lastMonth}
              onMonth={(by) => showMonth(shiftMonth(month, by))}
              onPick={pickDay}
            />
          </Rise>

          <div ref={flyer} className="events-board-flyer scroll-mt-28">
            {monthEvents.length ? (
              <FlyerCarousel events={monthEvents} index={Math.min(index, monthEvents.length - 1)} fallback={media.events} autoplay={autoplay} onIndex={pickFlyer} />
            ) : (
              <div className="flyer-empty">
                <PageBand asset={media.events} />
                <div className="flyer-empty-note">
                  <p className="editorial text-2xl italic leading-tight md:text-3xl">{upcoming.length ? t("events.monthEmpty") : t("events.empty")}</p>
                  {nextEvent ? (
                    <button type="button" className="flyer-schedule mt-5" onClick={() => showMonth(openingMonth(nextEvent, today))}>
                      {t("events.nextMonth")} →
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {current ? (
            <div className="events-board-info">
              <FlyerDetails event={current} />
            </div>
          ) : null}
        </section>

        {pastEvents.length ? (
          <section {...section("past", "Eventos anteriores")} className="mt-24 md:mt-32">
            <Rise className="max-w-2xl">
              <LeadTitle as="h2" text={t("events.pastTitle")} className="text-3xl md:text-5xl" />
              <p className="mt-4 text-base font-light leading-7 text-muted md:text-lg">{t("events.pastText")}</p>
            </Rise>
            <Rise className="mt-10">
              <PastEvents events={pastEvents} more={t("events.pastMore")} />
            </Rise>
          </section>
        ) : null}
      </article>
    </SiteLayout>
  );
}

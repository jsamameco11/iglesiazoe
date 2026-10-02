import { useEffect, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { EventSlider } from "@/Components/site/event-slider";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { eventBadge, eventDateLabel } from "@/lib/events";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { ChurchEvent, SiteSettings } from "@/lib/types";

export default function Events({
  events,
  settings,
  mediaOverrides,
  skin,
}: {
  events: ChurchEvent[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const [index, setIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("e");
    const found = wanted ? events.findIndex((event) => event.id === wanted) : -1;
    if (found > 0) setIndex(found);
  }, [events]);

  const pick = (next: number) => {
    setIndex(next);
    stage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={t("events.kicker")} title={settings.eventsTitle}>
            <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.eventsText}</p>
          </PageIntro>
        </Rise>

        {events.length ? (
          <>
            <div ref={stage} className="mt-14 scroll-mt-28 md:mt-20">
              <Rise>
                <EventSlider events={events} fallback={media.events} index={index} onIndex={setIndex} />
              </Rise>
            </div>

            {events.length > 1 ? (
              <section className="mt-24">
                <Rise>
                  <LeadTitle as="h2" text={t("events.agenda")} className="text-3xl md:text-4xl" />
                </Rise>
                <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((event, i) => {
                    const badge = eventBadge(event.starts_on);
                    return (
                      <button key={event.id} type="button" className="agenda-card" data-active={i === index || undefined} onClick={() => pick(i)}>
                        <span className="agenda-date">
                          <strong>{badge.day}</strong>
                          <span>{badge.month}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[1.02rem] font-medium tracking-[-0.02em] text-ink">{event.title}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-muted first-letter:uppercase">
                            {[eventDateLabel(event.starts_on, event.ends_on), event.location].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <Rise className="mt-14 grid items-center gap-10 lg:grid-cols-2">
            <div className="panel p-8 md:p-10">
              <p className="kicker">{t("events.agenda")}</p>
              <p className="editorial mt-4 text-3xl italic leading-tight md:text-4xl">{t("events.empty")}</p>
            </div>
            <PageBand asset={media.events} />
          </Rise>
        )}
      </article>
    </SiteLayout>
  );
}

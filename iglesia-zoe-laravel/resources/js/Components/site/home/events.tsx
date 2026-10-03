import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { EventSlider } from "@/Components/site/event-slider";
import { SectionHead } from "@/Components/site/home/section";
import { readCopy } from "@/lib/copy";
import type { MediaAsset } from "@/lib/media";
import type { ChurchEvent, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export function EventsSection({ settings, events, fallback }: { settings: SiteSettings; events: ChurchEvent[]; fallback: MediaAsset }) {
  const pages = useSitePages();
  if (!events.length) return null;
  return (
    <section {...section("events", "Eventos")} className="home-section">
      <Rise className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <SectionHead kicker={pages.section("home", "events")} title={settings.eventsTitle} />
          <p className="mt-5 max-w-lg text-base font-light leading-7">{settings.eventsText}</p>
        </div>
        <Link href="/eventos" className="home-link">
          {readCopy(settings, "home.eventsMore")} →
        </Link>
      </Rise>
      <Rise className="mt-12">
        <EventSlider events={events} fallback={fallback} compact />
      </Rise>
    </section>
  );
}

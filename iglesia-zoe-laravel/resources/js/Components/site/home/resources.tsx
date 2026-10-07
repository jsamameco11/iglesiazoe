import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { SectionHead } from "@/Components/site/section";
import { VideoCard } from "@/Components/site/sermons/video-card";
import { useTheater, VideoTheater } from "@/Components/site/sermons/video-theater";
import { readCopy } from "@/lib/copy";
import type { SermonSummary, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export function ResourcesSection({ settings, sermons }: { settings: SiteSettings; sermons: SermonSummary[] }) {
  const pages = useSitePages();
  const theater = useTheater(sermons);
  return (
    <section {...section("resources", "Palabra para tu semana")} className="home-section home-ink">
      <Rise className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <SectionHead tone="light" kicker={pages.section("home", "resources")} title={settings.resourcesTitle} />
          <p className="mt-5 max-w-lg text-base font-light leading-7 text-white/70">{settings.resourcesText}</p>
        </div>
        <Link href="/predicas" className="home-link text-white">
          {readCopy(settings, "home.resourcesMore")} →
        </Link>
      </Rise>
      {theater.playable.length ? (
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {theater.playable.map((sermon, index) => (
            <Rise key={sermon.id} delay={index * 100}>
              <VideoCard sermon={sermon} tone="dark" onPlay={() => theater.open(sermon)} />
            </Rise>
          ))}
        </div>
      ) : (
        <div>
          <p className="mt-10 max-w-lg text-white/60">{readCopy(settings, "home.resourcesEmpty")}</p>
        </div>
      )}
      {theater.index >= 0 ? <VideoTheater list={theater.playable} index={theater.index} onIndex={theater.show} onClose={theater.close} /> : null}
    </section>
  );
}

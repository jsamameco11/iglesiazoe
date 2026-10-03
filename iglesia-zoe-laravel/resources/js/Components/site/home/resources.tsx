import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { SectionHead } from "@/Components/site/section";
import { IconPlay } from "@/Components/site/icons";
import { readCopy } from "@/lib/copy";
import type { SermonSummary, SiteSettings } from "@/lib/types";
import { formatSermonDate, youtubeId } from "@/lib/youtube";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

function SermonCard({ sermon }: { sermon: SermonSummary }) {
  const video = youtubeId(sermon.youtube_id);
  const meta = [formatSermonDate(sermon.sermon_date), sermon.preacher].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="home-sermon-thumb">
        {video ? <img src={`https://i.ytimg.com/vi/${video}/hqdefault.jpg`} alt="" loading="lazy" /> : null}
        <span className="home-sermon-play"><IconPlay className="h-5 w-5" /></span>
      </span>
      {meta && <span className="mt-5 block text-xs uppercase tracking-[0.18em] text-white/50">{meta}</span>}
      <span className="mt-2 block text-xl font-light leading-snug text-white">{sermon.title}</span>
    </>
  );
  return video ? (
    <a href={`https://www.youtube.com/watch?v=${video}`} target="_blank" rel="noreferrer" className="home-sermon">
      {body}
    </a>
  ) : (
    <Link href="/predicas" className="home-sermon">
      {body}
    </Link>
  );
}

export function ResourcesSection({ settings, sermons }: { settings: SiteSettings; sermons: SermonSummary[] }) {
  const pages = useSitePages();
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
      {sermons.length ? (
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {sermons.map((sermon, index) => (
            <Rise key={sermon.id} delay={index * 100}>
              <SermonCard sermon={sermon} />
            </Rise>
          ))}
        </div>
      ) : (
        <div>
          <p className="mt-10 max-w-lg text-white/60">{readCopy(settings, "home.resourcesEmpty")}</p>
        </div>
      )}
    </section>
  );
}

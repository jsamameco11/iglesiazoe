import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaView } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { formatSermonDate, youtubeId } from "@/lib/youtube";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SermonSummary, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export default function Sermons({
  settings,
  sermons,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  sermons: SermonSummary[];
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const fallbackSeries = t("sermons.defaultSeries");
  const live = sermons.find((sermon) => sermon.is_live) || null;
  const liveId = youtubeId(settings.liveYoutubeId) || youtubeId(live?.youtube_id);
  const archive = sermons.filter((sermon) => sermon.id !== live?.id);
  const series = [...new Set(archive.map((sermon) => sermon.series || fallbackSeries))];

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro
            skin={skin}
            kicker={pages.kicker("sermons")}
            title={settings.sermonsTitle}
          />
        </Rise>
        <Rise {...section("live", "Transmisión")} delay={100}>
          {liveId ? (
            <div className="shot relative mt-12 aspect-video">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${liveId}`}
                title="Transmisión"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="shot relative mt-12 aspect-video">
              <div className="absolute inset-0">
                <MediaView asset={media.sermons} fit="cover" />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/15 to-black/25 p-8 md:p-14">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">{t("sermons.overlay")}</p>
                    <p className="display mt-3 max-w-xl text-4xl text-white">{settings.sermonsEmpty}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Rise>
        <Rise {...section("library", "Biblioteca de mensajes")}>
          <LeadTitle as="h2" lead={t("sermons.library")} className="mt-24 text-4xl md:text-5xl" />
        </Rise>
        {archive.length === 0 ? (
          <p className="mt-6 text-muted">{t("sermons.libraryEmpty")}</p>
        ) : (
          series.map((name, index) => (
            <Rise key={name} delay={index * 80}>
              <section {...section("series", "Series de mensajes")} className="mt-12">
                <h3 className="text-[11px] uppercase tracking-[0.22em] text-muted">{name}</h3>
                <div className="mt-6 divide-y divide-ink/10">
                  {archive.filter((sermon) => (sermon.series || fallbackSeries) === name).map((sermon) => {
                    const video = youtubeId(sermon.youtube_id);
                    return (
                      <a
                        key={sermon.id}
                        href={video ? `https://www.youtube.com/watch?v=${video}` : "#predicas"}
                        className="grid gap-2 py-6 md:grid-cols-[170px_1fr_180px] md:items-baseline"
                        target={video ? "_blank" : undefined}
                        rel="noreferrer"
                      >
                        <p className="text-sm text-muted">{formatSermonDate(sermon.sermon_date)}</p>
                        <p className="text-2xl font-light">{sermon.title}</p>
                        <p className="text-sm text-muted md:text-right">{sermon.preacher}</p>
                      </a>
                    );
                  })}
                </div>
              </section>
            </Rise>
          ))
        )}
      </article>
    </SiteLayout>
  );
}

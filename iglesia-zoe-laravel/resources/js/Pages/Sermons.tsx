import { useEffect, useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { IconPlay } from "@/Components/site/icons";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaSlides } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import { ChannelAvatar, CHANNEL_FALLBACK, VideoCard, videoMeta, VideoThumb } from "@/Components/site/sermons/video-card";
import { useTheater, VideoTheater } from "@/Components/site/sermons/video-theater";
import { LiveStage } from "@/Components/site/teachings/live-stage";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { useLiveState, type LiveState } from "@/lib/live";
import { videoClock, youtubeId } from "@/lib/youtube";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SermonSummary, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

const PAGE = 12;

/** Plain text to compare a search with a title, without accents or case. */
function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** The latest service, big, with its YouTube details next to it. */
function LatestVideo({ sermon, onPlay, t }: { sermon: SermonSummary; onPlay: () => void; t: (key: CopyKey) => string }) {
  const clock = videoClock(sermon.duration);
  const channel = sermon.channel || CHANNEL_FALLBACK;
  const video = youtubeId(sermon.youtube_id);
  return (
    <div className="yt-feature">
      <button type="button" className="yt-feature-thumb" onClick={onPlay} aria-label={`Reproducir: ${sermon.title}`}>
        <VideoThumb sermon={sermon} eager />
        <span className="video-play">
          <span>
            <IconPlay className="h-7 w-7" />
          </span>
        </span>
        {clock ? <span className="yt-card-time">{clock}</span> : null}
      </button>
      <div className="yt-feature-body">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{t("sermons.latest")}</p>
        <h2 className="mt-3 text-[1.9rem] font-medium leading-[1.12] tracking-[-0.03em] text-ink md:text-[2.2rem]">{sermon.title}</h2>
        <div className="mt-5 flex items-center gap-3">
          <ChannelAvatar name={channel} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">{channel}</p>
            <p className="text-[13px] text-muted">{videoMeta(sermon)}</p>
          </div>
        </div>
        {sermon.description ? <p className="mt-5 line-clamp-4 whitespace-pre-line text-[0.95rem] font-light leading-7 text-ink/80">{sermon.description}</p> : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" onClick={onPlay} className="btn-accent inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold">
            <IconPlay className="h-4 w-4" /> {t("sermons.watch")}
          </button>
          <a
            href={`https://www.youtube.com/watch?v=${video}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-5 py-2.5 text-[13.5px] font-semibold text-ink transition hover:border-ink/40"
          >
            {t("sermons.openYoutube")} ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Sermons({
  settings,
  sermons,
  live,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  sermons: SermonSummary[];
  live: LiveState;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const fallbackSeries = t("sermons.defaultSeries");
  const state = useLiveState(live);
  const theater = useTheater(sermons);
  const latest = theater.playable[0] || null;
  const archive = state.live ? theater.playable : theater.playable.slice(1);
  const series = [...new Set(archive.map((sermon) => sermon.series || fallbackSeries))];
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const results = useMemo(() => {
    const words = fold(query.trim()).split(/\s+/).filter(Boolean);
    return archive.filter((sermon) => {
      if (filter && (sermon.series || fallbackSeries) !== filter) return false;
      const haystack = fold(`${sermon.title} ${sermon.preacher || ""} ${sermon.series || ""}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [archive, filter, query, fallbackSeries]);

  useEffect(() => setShown(PAGE), [filter, query]);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("v");
    const match = wanted ? theater.playable.find((sermon) => youtubeId(sermon.youtube_id) === wanted) : null;
    if (match) theater.open(match);
    const target = !match && window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    if (target) window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

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
          {state.live ? (
            <section id="en-vivo" className="teach-stage mt-12 scroll-mt-24" data-on-air aria-live="polite">
              <LiveStage state={state} latest={null} t={t} />
            </section>
          ) : latest ? (
            <div id="en-vivo" className="mt-12 scroll-mt-24">
              <LatestVideo sermon={latest} onPlay={() => theater.open(latest)} t={t} />
            </div>
          ) : (
            <div id="en-vivo" className="shot relative mt-12 aspect-video scroll-mt-24">
              <div className="absolute inset-0">
                <MediaSlides asset={media.sermons} fit="cover" />
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
          <div className="mt-24 flex flex-wrap items-end justify-between gap-6">
            <LeadTitle as="h2" lead={t("sermons.library")} className="text-4xl md:text-5xl" />
            {archive.length > 0 ? (
              <label className="yt-search">
                <span className="sr-only">{t("sermons.search")}</span>
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 text-muted">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("sermons.search")} />
              </label>
            ) : null}
          </div>
        </Rise>
        {archive.length === 0 ? (
          <p className="mt-6 text-muted">{t("sermons.libraryEmpty")}</p>
        ) : (
          <section {...section("series", "Series de mensajes")} className="mt-8">
            {series.length > 1 ? (
              <div className="yt-chips" role="tablist" aria-label={t("sermons.library")}>
                {[null, ...series].map((name) => (
                  <button
                    key={name ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={filter === name}
                    className="yt-chip"
                    data-active={filter === name || undefined}
                    onClick={() => setFilter(name)}
                  >
                    {name ?? t("sermons.all")}
                    <span>{name ? archive.filter((sermon) => (sermon.series || fallbackSeries) === name).length : archive.length}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {results.length === 0 ? (
              <p className="mt-10 text-muted">{t("sermons.noResults")}</p>
            ) : (
              <div className="mt-10 grid gap-x-7 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
                {results.slice(0, shown).map((sermon) => (
                  <VideoCard key={sermon.id} sermon={sermon} onPlay={() => theater.open(sermon)} />
                ))}
              </div>
            )}
            {results.length > shown ? (
              <div className="mt-12 flex justify-center">
                <button type="button" onClick={() => setShown((count) => count + PAGE)} className="rounded-full border border-line px-6 py-3 text-[13.5px] font-semibold text-ink transition hover:border-ink/40">
                  {t("sermons.more")} ({results.length - shown})
                </button>
              </div>
            ) : null}
          </section>
        )}
      </article>
      {theater.index >= 0 ? <VideoTheater list={theater.playable} index={theater.index} onIndex={theater.show} onClose={theater.close} /> : null}
    </SiteLayout>
  );
}

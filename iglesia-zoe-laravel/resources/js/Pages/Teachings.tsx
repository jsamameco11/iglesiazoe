import { Link } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import { LiveStage } from "@/Components/site/teachings/live-stage";
import { TeachingCard } from "@/Components/site/teachings/teaching-card";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { useLiveState, type LiveState } from "@/lib/live";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SiteSettings, Teaching, TeachingKind } from "@/lib/types";
import { fold } from "@/lib/text";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

type Filter = "all" | TeachingKind;

export default function Teachings({
  teachings,
  live,
  settings,
  mediaOverrides,
  skin,
}: {
  teachings: Teaching[];
  live: LiveState;
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const state = useLiveState(live);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const latest = useMemo(() => teachings.find((item) => item.youtube_id) ?? teachings[0] ?? null, [teachings]);

  useEffect(() => {
    const target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    if (target) window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const counts = useMemo(
    () => ({ all: teachings.length, predica: teachings.filter((item) => item.kind === "predica").length, gc: teachings.filter((item) => item.kind === "gc").length }),
    [teachings],
  );
  const shown = useMemo(() => {
    const needle = fold(query.trim());
    return teachings.filter(
      (item) =>
        (filter === "all" || item.kind === filter) && (!needle || fold(`${item.title} ${item.preacher ?? ""} ${item.summary ?? ""}`).includes(needle)),
    );
  }, [teachings, filter, query]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: t("teachings.all") },
    { id: "predica", label: t("teachings.kindSermon") },
    { id: "gc", label: t("teachings.kindGroups") },
  ];

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={pages.kicker("teachings")} title={settings.teachingsTitle} media={<PageBand asset={media.teachings} />}>
            <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.teachingsText}</p>
            <Link href="/predicas" className="home-link mt-8">
              {t("teachings.sermons")} →
            </Link>
          </PageIntro>
        </Rise>

        <section id="en-vivo" {...section("stage", "En vivo y última enseñanza")} className="teach-stage mt-14" data-on-air={state.live || undefined} aria-live="polite">
          <LiveStage state={state} latest={latest} t={t} />
        </section>

        <section {...section("list", "Enseñanzas")} className="mt-20">
          <Rise>
            <h2 className="editorial text-3xl md:text-4xl">{t("teachings.listTitle")}</h2>
          </Rise>
          <Rise className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="pill-tabs" role="tablist">
              {tabs.map((tab) => (
                <button key={tab.id} type="button" role="tab" aria-selected={filter === tab.id} className="pill-tab" data-active={filter === tab.id || undefined} onClick={() => setFilter(tab.id)}>
                  {tab.label}
                  <small>{counts[tab.id]}</small>
                </button>
              ))}
            </div>
            {teachings.length > 6 ? (
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("teachings.search")}
                className="w-full max-w-xs rounded-full border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none transition focus:border-ink/40"
              />
            ) : null}
          </Rise>

          {shown.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((item) => (
                <TeachingCard key={item.id} item={item} t={t} />
              ))}
            </div>
          ) : (
            <Rise className="panel mt-8 p-8 md:p-10">
              <p className="editorial text-2xl italic leading-snug md:text-3xl">{t("teachings.empty")}</p>
            </Rise>
          )}
        </section>

        <Rise {...section("more", "Más recursos")} className="mt-20">
          <p className="kicker">{pages.section("teachings", "more")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { href: "/galeria", label: pages.name("gallery"), note: pages.note("gallery") },
              { href: "/devocionales", label: pages.name("devotionals"), note: pages.note("devotionals") },
              { href: "/predicas", label: pages.name("sermons"), note: pages.note("sermons") },
            ].map((link, index) => (
              <Link key={link.href} href={link.href} className="resource-link group">
                <span className="resource-link-num">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block text-[1.25rem] font-medium tracking-[-0.03em] text-ink">{link.label}</span>
                  <span className="mt-0.5 block text-[13.5px] text-muted">{link.note}</span>
                </span>
                <span className="resource-link-arrow" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </Rise>
      </article>
    </SiteLayout>
  );
}

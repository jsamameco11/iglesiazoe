import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SiteSettings, Teaching, TeachingKind } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";
import { section } from "@/lib/design";

type Filter = "all" | TeachingKind;

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function TeachingCard({ item, t }: { item: Teaching; t: (key: CopyKey) => string }) {
  const video = item.youtube_id ? `https://www.youtube.com/watch?v=${item.youtube_id}` : null;
  return (
    <article className="teaching-card lift">
      <div className="flex items-start justify-between gap-4">
        <span className="file-badge" data-kind={item.file_url ? undefined : "video"}>
          {item.file_type || "VIDEO"}
        </span>
        <span className="teaching-tag">{item.kind === "gc" ? t("teachings.kindGroups") : t("teachings.kindSermon")}</span>
      </div>
      <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-muted">{formatSermonDate(item.teaching_date)}</p>
      <h3 className="mt-2 text-[1.3rem] font-medium leading-snug tracking-[-0.02em] text-ink">{item.title}</h3>
      {item.summary ? <p className="mt-3 text-[0.95rem] font-light leading-7">{item.summary}</p> : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {item.file_url ? (
          <a href={item.file_url} target="_blank" rel="noreferrer" className="btn-accent rounded-full px-4 py-2 text-[13px] font-semibold">
            {t("teachings.download")} ↓
          </a>
        ) : null}
        {video ? (
          <a href={video} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-ink/40">
            {t("teachings.watch")} ▶
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function Teachings({
  teachings,
  settings,
  mediaOverrides,
  skin,
}: {
  teachings: Teaching[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({ all: teachings.length, predica: teachings.filter((item) => item.kind === "predica").length, gc: teachings.filter((item) => item.kind === "gc").length }),
    [teachings],
  );
  const shown = useMemo(() => {
    const needle = normalize(query.trim());
    return teachings.filter(
      (item) => (filter === "all" || item.kind === filter) && (!needle || normalize(`${item.title} ${item.summary ?? ""}`).includes(needle)),
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
          <PageIntro skin={skin} kicker={t("teachings.kicker")} title={settings.teachingsTitle} media={<PageBand asset={media.teachings} />}>
            <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.teachingsText}</p>
            <Link href="/predicas" className="home-link mt-8">
              {t("teachings.sermons")} →
            </Link>
          </PageIntro>
        </Rise>

        <Rise {...section("more", "Más recursos")} className="mt-16">
          <p className="kicker">{t("teachings.more")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { href: "/galeria", label: t("nav.gallery"), note: t("nav.galleryNote") },
              { href: "/devocionales", label: t("nav.devotionals"), note: t("nav.devotionalsNote") },
              { href: "/predicas", label: t("nav.sermons"), note: t("nav.sermonsNote") },
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
      </article>
    </SiteLayout>
  );
}

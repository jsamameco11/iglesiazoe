import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { DevotionalCard } from "@/Components/site/devotional-card";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Devotional, SiteSettings } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function Devotionals({
  devotionals,
  settings,
  mediaOverrides,
  skin,
}: {
  devotionals: Devotional[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const [query, setQuery] = useState("");
  const [latest, ...archive] = devotionals;
  const shown = useMemo(() => {
    const needle = normalize(query.trim());
    return needle ? archive.filter((item) => normalize(`${item.title} ${item.verse_ref ?? ""} ${item.excerpt}`).includes(needle)) : archive;
  }, [archive, query]);

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={t("devotionals.kicker")} title={t("devotionals.title")} media={<PageBand asset={media.devotionals} />}>
            <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{t("devotionals.text")}</p>
          </PageIntro>
        </Rise>

        {latest ? (
          <Rise className="mt-20">
            <Link href={`/devocionales/${latest.slug}`} className="devo-feature group">
              <span className="devo-feature-photo">
                <img src={latest.image || media.devotionals.src} alt="" />
              </span>
              <span className="devo-feature-body">
                <span className="kicker">{t("devotionals.latest")}</span>
                <span className="devo-card-meta mt-3">
                  {formatSermonDate(latest.publish_on)} · {latest.minutes} {t("devotionals.minutes")}
                </span>
                <span className="editorial mt-3 block text-4xl leading-[1.05] text-ink md:text-5xl">{latest.title}</span>
                {latest.verse_text ? (
                  <span className="devo-verse mt-6">
                    «{latest.verse_text}»{latest.verse_ref ? <cite>{latest.verse_ref}</cite> : null}
                  </span>
                ) : null}
                <span className="mt-5 block text-[1.02rem] leading-7 text-muted">{latest.excerpt}</span>
                <span className="btn-accent mt-8 inline-flex w-fit rounded-full px-6 py-3 text-sm font-semibold">{t("devotionals.read")} →</span>
              </span>
            </Link>
          </Rise>
        ) : (
          <Rise className="panel mt-16 p-8 md:p-10">
            <p className="editorial text-2xl italic leading-snug md:text-3xl">{t("devotionals.empty")}</p>
          </Rise>
        )}

        {archive.length ? (
          <section className="mt-24">
            <Rise className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="editorial text-3xl md:text-4xl">{t("devotionals.archive")}</h2>
              {archive.length > 6 ? (
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("devotionals.search")}
                  className="w-full max-w-xs rounded-full border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none transition focus:border-ink/40"
                />
              ) : null}
            </Rise>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((item) => (
                <DevotionalCard key={item.id} item={item} t={t} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </SiteLayout>
  );
}

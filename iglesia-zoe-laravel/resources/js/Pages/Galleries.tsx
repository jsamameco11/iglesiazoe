import { useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { GalleryCard } from "@/Components/site/gallery";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { GalleryKind, ServiceGallery, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

type Filter = "all" | GalleryKind;

export default function Galleries({
  galleries,
  settings,
  mediaOverrides,
  skin,
}: {
  galleries: ServiceGallery[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const [filter, setFilter] = useState<Filter>("all");

  const tabs = useMemo(() => {
    const all: { id: Filter; label: string }[] = [
      { id: "all", label: t("gallery.all") },
      { id: "dominical", label: t("gallery.sunday") },
      { id: "media-semana", label: t("gallery.midweek") },
      { id: "especial", label: t("gallery.special") },
    ];
    return all
      .map((tab) => ({ ...tab, count: tab.id === "all" ? galleries.length : galleries.filter((item) => item.kind === tab.id).length }))
      .filter((tab) => tab.id === "all" || tab.count > 0);
  }, [galleries, settings]);

  const shown = filter === "all" ? galleries : galleries.filter((item) => item.kind === filter);
  const [first, ...rest] = shown;

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={pages.kicker("gallery")} title={t("gallery.title")} media={<PageBand asset={media.gallery} />}>
            <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{t("gallery.text")}</p>
          </PageIntro>
        </Rise>

        {galleries.length ? (
          <section {...section("albums", "Álbumes")} className="mt-20">
            {tabs.length > 2 ? (
              <Rise>
                <div className="pill-tabs" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={filter === tab.id}
                      className="pill-tab"
                      data-active={filter === tab.id || undefined}
                      onClick={() => setFilter(tab.id)}
                    >
                      {tab.label}
                      <small>{tab.count}</small>
                    </button>
                  ))}
                </div>
              </Rise>
            ) : null}

            {first ? (
              <Rise className="mt-8">
                <GalleryCard gallery={first} t={t} featured />
              </Rise>
            ) : null}
            {rest.length ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((gallery) => (
                  <GalleryCard key={gallery.id} gallery={gallery} t={t} />
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <Rise {...section("empty", "Sin álbumes")} className="panel mt-16 p-8 md:p-10">
            <p className="editorial text-2xl italic leading-snug md:text-3xl">{t("gallery.empty")}</p>
          </Rise>
        )}
      </article>
    </SiteLayout>
  );
}

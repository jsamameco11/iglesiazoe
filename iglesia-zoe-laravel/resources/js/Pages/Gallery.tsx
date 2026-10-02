import { Link } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { GALLERY_KIND, GalleryCard, Lightbox } from "@/Components/site/gallery";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import type { ServiceGallery, ServiceGalleryFull, SiteSettings } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";
import { section } from "@/lib/design";

export default function Gallery({ gallery, others, settings }: { gallery: ServiceGalleryFull; others: ServiceGallery[]; settings: SiteSettings }) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <Link href="/galeria" className="text-sm text-muted transition hover:text-ink">← {t("gallery.back")}</Link>
          <header {...section("intro", "Portada")} className="mt-10 flex flex-wrap items-end justify-between gap-6 border-b border-ink/10 pb-10">
            <div className="max-w-3xl">
              <p className="kicker">
                {t(GALLERY_KIND[gallery.kind])} · {formatSermonDate(gallery.service_date)}
              </p>
              <h1 className="editorial mt-4 text-5xl leading-[1.02] md:text-7xl">{gallery.title}</h1>
              {gallery.summary ? <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{gallery.summary}</p> : null}
            </div>
            <p className="text-sm font-medium text-muted">
              {gallery.count} {t("gallery.photos")}
            </p>
          </header>
        </Rise>

        <div {...section("photos", "Fotos")} className="gallery-masonry mt-10">
          {gallery.photos.map((photo, index) => (
            <button key={photo} type="button" className="gallery-tile" onClick={() => setOpen(index)} aria-label={`Ver foto ${index + 1}`}>
              <img src={photo} alt="" loading={index < 8 ? "eager" : "lazy"} />
            </button>
          ))}
        </div>

        {others.length ? (
          <section {...section("others", "Otros álbumes")} className="mt-24">
            <Rise className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="editorial text-3xl md:text-4xl">{t("gallery.others")}</h2>
              <Link href="/galeria" className="home-link">{t("gallery.back")} →</Link>
            </Rise>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((item) => (
                <GalleryCard key={item.id} gallery={item} t={t} />
              ))}
            </div>
          </section>
        ) : null}
      </article>

      {open !== null ? <Lightbox photos={gallery.photos} index={open} title={gallery.title} t={t} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </SiteLayout>
  );
}

import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { Paragraphs, SectionHead } from "@/Components/site/section";
import { MediaSlides } from "@/Components/site/media-view";
import type { MediaAsset } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export function CellsSection({ settings, asset }: { settings: SiteSettings; asset: MediaAsset }) {
  const pages = useSitePages();
  return (
    <section {...section("cells", "Grupos celulares")} className="home-section home-sand">
      <div className="home-split">
        <Rise from="left">
          <div className="home-photo shot">
            <MediaSlides asset={asset} fit="cover" />
          </div>
        </Rise>
        <Rise from="right" delay={120}>
          <SectionHead kicker={pages.section("home", "cells")} title={settings.cellsTitle} />
          <Paragraphs text={settings.cellsText} className="mt-8 max-w-xl" />
          <Link href="/visita" className="home-link mt-9">
            {settings.cellsCta} →
          </Link>
        </Rise>
      </div>
    </section>
  );
}

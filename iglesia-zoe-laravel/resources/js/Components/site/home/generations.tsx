import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { SectionHead } from "@/Components/site/section";
import { MinistryCards } from "@/Components/site/ministry-cards";
import { readCopy } from "@/lib/copy";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export function GenerationsSection({ settings, ministries, media }: { settings: SiteSettings; ministries: Ministry[]; media: ResolvedMedia }) {
  const pages = useSitePages();
  if (!ministries.length) return null;
  return (
    <section {...section("generations", "Generaciones")} className="home-section">
      <Rise className="flex flex-wrap items-end justify-between gap-6">
        <SectionHead kicker={pages.section("home", "generations")} title={settings.generationsTitle} />
        <Link href="/ministerios" className="home-link">
          {readCopy(settings, "home.generationsMore")} →
        </Link>
      </Rise>
      <MinistryCards ministries={ministries} media={media} className="mt-12" rotate />
    </section>
  );
}

import { Rise } from "@/Components/motion/rise";
import { Paragraphs, SectionHead } from "@/Components/site/home/section";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export function EssenceSection({ settings }: { settings: SiteSettings }) {
  const pages = useSitePages();
  return (
    <section {...section("essence", "El origen de nuestro nombre")} className="home-section">
      <Rise className="mx-auto max-w-3xl text-center">
        <SectionHead kicker={pages.section("home", "essence")} title={settings.essenceTitle} />
        <Paragraphs text={settings.essenceText} className="home-prose-lead mx-auto mt-10 max-w-2xl" />
      </Rise>
    </section>
  );
}

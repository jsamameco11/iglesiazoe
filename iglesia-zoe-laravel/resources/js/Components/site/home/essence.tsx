import { Rise } from "@/Components/motion/rise";
import { Paragraphs, SectionHead } from "@/Components/site/home/section";
import { readCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";

export function EssenceSection({ settings }: { settings: SiteSettings }) {
  return (
    <section {...section("essence", "El origen de nuestro nombre")} className="home-section">
      <Rise className="mx-auto max-w-3xl text-center">
        <SectionHead kicker={readCopy(settings, "home.essenceKicker")} title={settings.essenceTitle} />
        <Paragraphs text={settings.essenceText} className="home-prose-lead mx-auto mt-10 max-w-2xl" />
      </Rise>
    </section>
  );
}

import type { Metadata } from "next";
import { VisitForm } from "@/components/site/forms";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Planifica tu visita" };

export default async function VisitPage() {
  const [media, settings] = await Promise.all([getSiteMedia(), getSettings()]);
  return (
    <article className="page-wrap">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <p className="kicker">Primera vez</p>
          <LeadTitle text={settings.visitTitle} className="mt-4 text-5xl md:text-7xl" />
          <p className="mt-6 max-w-md text-lg font-light leading-8 text-muted">{settings.visitText}</p>
        </Rise>
        <Rise delay={120}>
          <MediaView asset={media.visit} />
        </Rise>
      </div>
      <Rise delay={80}>
        <div className="panel mt-16 max-w-3xl p-7 md:p-10">
          <VisitForm cta={settings.visitCta} sunday={settings.sunday} wednesday={settings.wednesday} />
        </div>
      </Rise>
    </article>
  );
}

import type { Metadata } from "next";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MinistryCards, MinistryFeature } from "@/components/site/ministry-feature";
import { getMinistries, getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Ministerios" };

export default async function MinistriesPage() {
  const [ministries, media, settings] = await Promise.all([getMinistries(), getSiteMedia(), getSettings()]);
  return (
    <article className="pb-16">
      <div className="page-wrap pb-0">
        <Rise>
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Ministerios</p>
          <LeadTitle text={settings.ministriesTitle} className="mt-4 max-w-4xl text-5xl md:text-7xl" />
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.ministriesText}</p>
        </Rise>
      </div>
      <MinistryFeature settings={settings} ministries={ministries} media={media} showCopy={false} />
      <div className="mt-8">
        <MinistryCards ministries={ministries} media={media} />
      </div>
    </article>
  );
}

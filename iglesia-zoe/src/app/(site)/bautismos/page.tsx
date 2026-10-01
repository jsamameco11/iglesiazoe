import type { Metadata } from "next";
import { BaptismForm } from "@/components/site/forms";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getBaptismEvents, getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Bautismos" };

export default async function BaptismPage() {
  const [events, media, settings] = await Promise.all([getBaptismEvents(), getSiteMedia(), getSettings()]);
  const next = events[0];
  const dateLabel = next?.event_date
    ? new Date(next.event_date + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : settings.baptismDateFallback;

  return (
    <article className="page-wrap">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <p className="kicker">Bautismos</p>
          <LeadTitle text={settings.baptismTitle} className="mt-4 text-5xl md:text-7xl" />
          <p className="ital mt-5 text-2xl text-muted">{settings.baptismLead}</p>
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.baptismBody}</p>
          <dl className="mt-12 grid gap-8 sm:grid-cols-2">
            <div>
              <dt className="kicker">{settings.baptismDateLabel}</dt>
              <dd className="display mt-3 text-3xl">{dateLabel}</dd>
            </div>
            <div>
              <dt className="kicker">{settings.baptismRequirementLabel}</dt>
              <dd className="mt-3 text-lg font-light leading-7">{settings.baptismRequirement}</dd>
            </div>
          </dl>
        </Rise>
        <Rise delay={120}>
          <PageBand asset={media.baptism} />
        </Rise>
      </div>
      <Rise delay={80}>
        <div className="panel mx-auto mt-16 max-w-3xl p-7 md:p-10">
          <BaptismForm events={events} cta={settings.baptismCta} fallback={settings.baptismDateFallback} />
        </div>
      </Rise>
    </article>
  );
}

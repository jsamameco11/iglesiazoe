import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import { PrayerLight, VisitInvite } from "@/Components/site/prayer-scene";
import { PrayerRequestForm } from "@/Components/site/prayer-request";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { messengerUrl } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";
import "../../css/oracion.css";

export default function Contact({
  settings,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout>
      <article className="page-wrap pb-8">
        <Rise>
          <PageIntro skin={skin} kicker="Oración" title={settings.contactTitle} media={<PageBand asset={media.contact} />}>
            <div className="mt-8 space-y-1 text-lg font-light text-muted">
              <p>{settings.address}</p>
              <p>{settings.sunday}</p>
              <p>{settings.wednesday}</p>
              {settings.phone && <p>{settings.phone}</p>}
              {settings.email && <p>{settings.email}</p>}
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-medium">
              <a href={messengerUrl} target="_blank" rel="noreferrer">Messenger</a>
              {settings.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a>}
              {settings.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer">YouTube</a>}
              <a href={settings.mapUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
            </div>
          </PageIntro>
        </Rise>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <Rise className="h-full" from="left">
            <PrayerLight />
          </Rise>
          <Rise delay={100} className="h-full" from="right">
            <div id="peticion" className="panel h-full p-7 md:p-10">
              <p className="kicker">Escríbenos</p>
              <LeadTitle as="h2" text={settings.prayerTitle || "¿Cómo podemos orar por ti?"} className="mt-3 text-4xl md:text-5xl" />
              <p className="mt-4 max-w-md text-sm leading-6 text-muted">
                Elige el motivo y cuéntanos tu petición. Oraremos por ti con cariño y discreción.
              </p>
              <div className="mt-8">
                <PrayerRequestForm />
              </div>
            </div>
          </Rise>
        </div>

        <Rise>
          <div className="mt-16">
            <VisitInvite sunday={settings.sunday} wednesday={settings.wednesday} />
          </div>
        </Rise>
      </article>
    </SiteLayout>
  );
}

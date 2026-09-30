import type { Metadata } from "next";
import { PrayerForm } from "@/components/site/forms";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Contacto" };

export default async function ContactPage() {
  const [settings, media] = await Promise.all([getSettings(), getSiteMedia()]);
  return (
    <article className="page-wrap">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <p className="kicker">Contacto y oración</p>
          <LeadTitle lead="Estamos para" accent="acompañarte." className="mt-4 text-5xl md:text-7xl" />
          <div className="mt-8 space-y-1 text-lg font-light text-muted">
            <p>{settings.address}</p>
            <p>{settings.sunday}</p>
            <p>{settings.wednesday}</p>
            {settings.phone && <p>{settings.phone}</p>}
            {settings.email && <p>{settings.email}</p>}
          </div>
          <div className="mt-8 flex gap-5 text-sm font-medium">
            {settings.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a>}
            {settings.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer">YouTube</a>}
            <a href={settings.mapUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
          </div>
        </Rise>
        <Rise delay={120}>
          <PageBand asset={media.contact} ratio="aspect-[16/10] lg:aspect-[5/4]" />
        </Rise>
      </div>
      <div className="mt-16 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <div className="shot h-72 md:h-full md:min-h-80">
            <iframe
              title="Mapa"
              className="h-full min-h-72 w-full"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}&z=16&output=embed`}
            />
          </div>
        </Rise>
        <Rise delay={100}>
          <div className="panel p-7 md:p-10">
            <LeadTitle as="h2" lead="Petición de" accent="oración" className="text-4xl" />
            <div className="mt-8">
              <PrayerForm />
            </div>
          </div>
        </Rise>
      </div>
    </article>
  );
}

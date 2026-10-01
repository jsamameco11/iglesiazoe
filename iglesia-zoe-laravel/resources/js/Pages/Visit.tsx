import { VisitForm } from "@/Components/site/visit-form";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaView } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { messengerUrl } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";
import "../../css/oracion.css";

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function telHref(value: string) {
  const n = digits(value);
  if (!n) return undefined;
  return `tel:+${n.startsWith("51") ? n : `51${n}`}`;
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.6 4.8h2.2l1.1 2.7-1.4 1.4a12.6 12.6 0 0 0 6 6l1.4-1.4 2.7 1.1v2.2c0 .7-.5 1.4-1.2 1.5A15.4 15.4 0 0 1 5.1 6c.1-.7.8-1.2 1.5-1.2Z" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path strokeLinecap="round" d="m4.2 7.4 7.8 6.2 7.8-6.2" />
    </svg>
  );
}

export default function Visit({
  mediaOverrides,
  settings,
  skin,
}: {
  mediaOverrides: Record<string, MediaAsset>;
  settings: SiteSettings;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const phone = settings.phone?.trim() || "(074) 252525";
  const email = settings.email?.trim().toLowerCase() || "iglesiacristianazoe@gmail.com";
  const address = settings.address?.trim() || "Calle Bolívar 755, Chiclayo";
  const call = telHref(phone);
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;

  return (
    <SiteLayout>
      <article className="page-wrap pb-8">
        <Rise>
          <PageIntro skin={skin} kicker="Primera vez" title={settings.visitTitle} media={<MediaView asset={media.visit} />}>
            <p className="mt-6 max-w-md text-lg font-light leading-8 text-muted">{settings.visitText}</p>
          </PageIntro>
        </Rise>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          <Rise>
            <div className="panel h-full p-7 md:p-10">
              <p className="kicker">Bienvenida</p>
              <LeadTitle as="h2" text="Deja tus datos y te recibimos." className="mt-3 text-4xl md:text-5xl" />
              <p className="mt-4 max-w-md text-sm leading-6 text-muted">
                Un equipo de la casa estará atento para acompañarte en tu primera visita.
              </p>
              <div className="mt-8">
                <VisitForm cta={settings.visitCta} sunday={settings.sunday} wednesday={settings.wednesday} />
              </div>
            </div>
          </Rise>
          <Rise delay={90} className="h-full">
            <div className="visit-map-wrap">
              <div className="shot visit-map">
                <iframe title="Cómo llegar a Iglesia Zoe" className="h-full w-full" src={mapSrc} loading="lazy" />
              </div>
            </div>
          </Rise>
        </div>

        <Rise>
          <div className="mt-20 text-center">
            <p className="kicker">Visítanos</p>
            <LeadTitle text="Nuestros datos de contacto" className="mt-4 text-4xl md:text-6xl" />
          </div>
        </Rise>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Rise className="h-full">
            <div className="swatch visit-card h-full" style={{ background: "var(--sage)" }}>
              <span className="visit-icon"><IconPhone /></span>
              <div className="visit-card-body">
                <p className="headline text-[1.7rem] leading-none">Nuestros teléfonos</p>
                <p className="editorial mt-3 text-2xl italic">Llámanos</p>
                {call ? <a href={call} className="mt-3 block text-[15px]">{phone}</a> : <p className="mt-3 text-[15px]">{phone}</p>}
                <p className="editorial mt-5 text-2xl italic">Escríbenos</p>
                <a href={messengerUrl} className="mt-2 block text-[15px]" target="_blank" rel="noreferrer">Messenger de la iglesia</a>
              </div>
            </div>
          </Rise>
          <Rise delay={90} className="h-full">
            <a href={settings.mapUrl || mapSrc} target="_blank" rel="noreferrer" className="swatch visit-card h-full" style={{ background: "var(--dusk)" }}>
              <span className="visit-icon"><IconPin /></span>
              <div className="visit-card-body">
                <p className="headline text-[1.7rem] leading-none">Nuestra dirección</p>
                <p className="editorial mt-3 text-2xl italic">Visítanos</p>
                <p className="mt-3 text-[15px] leading-6">{address}</p>
                <p className="mt-1 text-[15px] opacity-70">{settings.city}</p>
                <p className="mt-4 text-sm opacity-70">{settings.sunday}</p>
              </div>
            </a>
          </Rise>
          <Rise delay={180} className="h-full">
            <a href={`mailto:${email}`} className="swatch visit-card h-full" style={{ background: "var(--clay)" }}>
              <span className="visit-icon"><IconMail /></span>
              <div className="visit-card-body">
                <p className="headline text-[1.7rem] leading-none">Nuestro correo</p>
                <p className="editorial mt-3 text-2xl italic">Contáctanos</p>
                <p className="mt-3 text-[15px] [overflow-wrap:anywhere]">{email}</p>
                <p className="mt-4 text-sm opacity-70">Te respondemos lo antes posible.</p>
              </div>
            </a>
          </Rise>
        </div>
      </article>
    </SiteLayout>
  );
}

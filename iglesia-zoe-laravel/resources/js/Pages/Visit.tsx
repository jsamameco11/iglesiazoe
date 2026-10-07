import { VisitForm } from "@/Components/site/visit-form";
import { Rise } from "@/Components/motion/rise";
import { IconMail, IconMessenger, IconPin } from "@/Components/site/icons";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaView, PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { mapEmbedUrl } from "@/lib/contact";
import { resolveMedia, slidesOf, type MediaAsset } from "@/lib/media";
import { useCopy } from "@/lib/copy";
import { useSocial } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";
import "../../css/oracion.css";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export default function Visit({
  mediaOverrides,
  settings,
  skin,
}: {
  mediaOverrides: Record<string, MediaAsset>;
  settings: SiteSettings;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = useCopy();
  const social = useSocial();
  const email = settings.email?.trim().toLowerCase() || "iglesiacristianazoe@gmail.com";
  const address = settings.address?.trim() || "Simón Bolívar 750, Chiclayo";
  const mapSrc = mapEmbedUrl(address);

  return (
    <SiteLayout>
      <article className="page-wrap pb-8">
        <Rise>
          <PageIntro skin={skin} kicker={pages.kicker("visit")} title={settings.visitTitle} media={slidesOf(media.visit).length > 1 ? <PageBand asset={media.visit} /> : <MediaView asset={media.visit} />}>
            <p className="mt-6 max-w-md text-lg font-light leading-8 text-muted">{settings.visitText}</p>
          </PageIntro>
        </Rise>

        <div {...section("form", "Formulario y mapa")} className="mt-14 grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          <Rise>
            <div className="panel h-full p-7 md:p-10">
              <p className="kicker">{pages.section("visit", "form")}</p>
              <LeadTitle as="h2" text={t("visit.formTitle")} className="mt-3 text-4xl md:text-5xl" />
              <p className="mt-4 max-w-md text-sm leading-6 text-muted">
                {t("visit.formText")}
              </p>
              <div className="mt-8">
                <VisitForm cta={pages.name("visit")} sunday={settings.sunday} wednesday={settings.wednesday} />
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
          <div {...section("contact", "Contacto")} className="mt-20 text-center">
            <p className="kicker">{pages.section("visit", "contact")}</p>
            <LeadTitle text={t("visit.contactTitle")} className="mt-4 text-4xl md:text-6xl" />
          </div>
        </Rise>

        <div {...section("contact-cards", "Tarjetas de contacto")} className={`mt-10 grid gap-4 ${social.messenger ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {social.messenger && (
            <Rise className="h-full">
              <a href={social.messenger} target="_blank" rel="noreferrer" className="swatch visit-card h-full" style={{ background: "var(--sage)" }}>
                <span className="visit-icon"><IconMessenger /></span>
                <div className="visit-card-body">
                  <p className="headline text-[1.7rem] leading-none">{t("visit.messengerTitle")}</p>
                  <p className="editorial mt-3 text-2xl italic">{t("visit.messengerSub")}</p>
                  <p className="mt-3 text-[15px]">{t("visit.messenger")} →</p>
                  <p className="mt-4 text-sm opacity-70">{t("visit.messengerNote")}</p>
                </div>
              </a>
            </Rise>
          )}
          <Rise delay={90} className="h-full">
            <a href={settings.mapUrl || mapSrc} target="_blank" rel="noreferrer" className="swatch visit-card h-full" style={{ background: "var(--dusk)" }}>
              <span className="visit-icon"><IconPin /></span>
              <div className="visit-card-body">
                <p className="headline text-[1.7rem] leading-none">{t("visit.addressTitle")}</p>
                <p className="editorial mt-3 text-2xl italic">{t("visit.addressSub")}</p>
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
                <p className="headline text-[1.7rem] leading-none">{t("visit.mailTitle")}</p>
                <p className="editorial mt-3 text-2xl italic">{t("visit.mailSub")}</p>
                <p className="mt-3 text-[15px] [overflow-wrap:anywhere]">{email}</p>
                <p className="mt-4 text-sm opacity-70">{t("visit.mailNote")}</p>
              </div>
            </a>
          </Rise>
        </div>
      </article>
    </SiteLayout>
  );
}

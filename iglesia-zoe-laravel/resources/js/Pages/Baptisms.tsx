import { BaptismForm } from "@/Components/site/baptism-form";
import { Rise } from "@/Components/motion/rise";
import { BaptismReel } from "@/Components/site/baptism-reel";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageIntro } from "@/Components/site/page-intro";
import { VideoFeature } from "@/Components/site/video-feature";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";

export default function Baptisms({
  events,
  mediaOverrides,
  settings,
  skin,
}: {
  events: { id: string; event_date: string | null; location: string | null }[];
  mediaOverrides: Record<string, MediaAsset>;
  settings: SiteSettings;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const next = events[0];
  const dateLabel = next?.event_date
    ? new Date(next.event_date + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : settings.baptismDateFallback;

  const t = (key: CopyKey) => readCopy(settings, key);
  const hasVideo = Boolean(settings.baptismVideo) || (media.baptismVideo.kind === "video" && Boolean(media.baptismVideo.src));

  const formCard = (
    <div className="panel baptism-form-card">
      <p className="kicker">{t("baptism.formKicker")}</p>
      <LeadTitle as="h2" text={t("baptism.formTitle")} className="mt-3 text-3xl md:text-4xl" />
      <p className="mt-3 max-w-md text-sm leading-6 text-muted">
        {t("baptism.formText")}
      </p>
      <div className="mt-7">
        <BaptismForm events={events} cta={settings.baptismCta} fallback={settings.baptismDateFallback} />
      </div>
    </div>
  );

  return (
    <SiteLayout>
      <article>
        <div className="page-wrap baptism-intro">
          <Rise>
            <PageIntro skin={skin} kicker={t("baptism.kicker")} title={settings.baptismTitle} media={formCard}>
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
            </PageIntro>
          </Rise>
        </div>

        {hasVideo ? (
          <section className="px-6 pb-4 pt-20 md:px-16 md:pt-28">
            <div className="section-wrap grid items-center gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
              <Rise>
                <p className="kicker">{t("baptism.videoKicker")}</p>
                <LeadTitle as="h2" text={settings.baptismVideoTitle} className="mt-4 text-4xl leading-[1.05] md:text-5xl" />
                <p className="mt-5 max-w-md text-base font-light leading-7">{settings.baptismVideoText}</p>
              </Rise>
              <Rise from="right">
                <VideoFeature youtube={settings.baptismVideo} asset={media.baptismVideo} title={settings.baptismVideoTitle} />
              </Rise>
            </div>
          </section>
        ) : null}

        <section className="baptism-band" aria-label="Galería de bautismos">
          <span className="baptism-band-cross" aria-hidden="true" />
          <Rise>
            <div className="baptism-band-head">
              <p className="baptism-band-kicker">{t("baptism.galleryKicker")}</p>
              <LeadTitle as="h2" text={t("baptism.galleryTitle")} className="mt-4 text-4xl md:text-6xl" />
            </div>
          </Rise>
          <BaptismReel title="Bautismos en Iglesia Cristiana Zoe" items={media.baptismGallery} interval={3000} />
          <p className="baptism-band-caption">{t("baptism.galleryCaption")}</p>
        </section>
      </article>
    </SiteLayout>
  );
}

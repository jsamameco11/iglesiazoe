import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { WriteOnce } from "@/Components/motion/write-once";
import { AboutSlides } from "@/Components/site/about-slides";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import SiteLayout from "@/Layouts/SiteLayout";
import { useCopy } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";

export default function About({
  settings,
  mediaOverrides,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = useCopy();
  const pastors = { ...media.aboutPastors, alt: media.aboutPastors.alt || settings.pastorsLabel };
  const washes = ["var(--amber)", "var(--dusk)", "var(--clay)", "var(--sage)"];

  return (
    <SiteLayout overMedia="page">
      <article className="about-page">
        <AboutSlides
          items={media.aboutGallery}
          label="Fotos de Iglesia Cristiana Zoe"
          aside={settings.address ? <p className="about-slides-address">{settings.address}</p> : null}
        >
          <p className="about-slides-kicker">{settings.aboutKicker || "Conócenos"}</p>
          <LeadTitle text={settings.aboutTitle} className="mt-4 text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-7xl" />
          <blockquote className="about-slides-quote">
            <p className="editorial">
              <WriteOnce text={settings.aboutQuote} />
            </p>
          </blockquote>
        </AboutSlides>

        <div className="page-wrap about-rest">
        <section {...section("pastors", "Pastores")} className="about-pastors">
          <Rise from="left">
            <p className="kicker">{t("about.pastorsKicker")}</p>
            <LeadTitle as="h2" text={settings.pastorsLabel} className="mt-3 text-4xl md:text-6xl" />
            <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.aboutText}</p>
          </Rise>
          <Rise delay={140} from="right">
            <figure className="about-pastors-photo">
              <PageBand asset={pastors} />
            </figure>
          </Rise>
        </section>

        <div {...section("facts", "Horarios y dirección")} className="about-facts">
          {[
            [t("facts.sunday"), settings.sunday],
            [t("facts.week"), settings.wednesday],
            [t("facts.place"), settings.address],
          ].map(([label, value], index) => (
            <Rise key={label} delay={index * 90}>
              <div className="about-fact">
                <p className="kicker">{label}</p>
                <p className="editorial mt-3 text-2xl md:text-3xl">{value}</p>
              </div>
            </Rise>
          ))}
        </div>

        <section {...section("history", "Nuestra historia")} className="about-history">
          <Rise from="left">
            <p className="kicker">{t("about.historyKicker")}</p>
            <LeadTitle as="h2" text={t("about.historyTitle")} className="mt-5 text-5xl md:text-7xl" />
          </Rise>
          <Rise delay={120} from="right">
            <p className="about-history-text">{settings.history}</p>
          </Rise>
        </section>

        <Rise from="scale">
          <section {...section("vision", "Visión")} className="about-vision">
            <p className="text-[11px] uppercase tracking-[0.32em] opacity-55">{t("about.visionKicker")}</p>
            <p className="editorial mx-auto mt-6 max-w-4xl text-4xl italic leading-[1.12] md:text-6xl">
              “{settings.vision}”
            </p>
          </section>
        </Rise>

        <section {...section("values", "Valores")} className="about-values">
          <Rise>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="kicker">{t("about.valuesKicker")}</p>
                <LeadTitle as="h2" text={settings.aboutValuesTitle} className="mt-4 text-5xl md:text-6xl" />
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted">{settings.aboutValuesText}</p>
            </div>
          </Rise>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {settings.values.map((value, index) => (
              <Rise key={value.title} delay={index * 90} from={index % 2 ? "right" : "left"}>
                <article className="swatch about-value" style={{ background: washes[index % washes.length] }}>
                  <p className="text-[11px] uppercase tracking-[0.28em] opacity-50">0{index + 1}</p>
                  <div>
                    <h3 className="editorial text-4xl italic md:text-5xl">{value.title}</h3>
                    <p className="mt-4 max-w-md text-base leading-7 opacity-75">{value.text}</p>
                  </div>
                </article>
              </Rise>
            ))}
          </div>
        </section>

        <Rise from="scale">
          <section {...section("first-visit", "Tu primera visita")} className="first-visit">
            <p className="kicker">{t("about.firstKicker")}</p>
            <LeadTitle text={t("about.firstTitle")} className="mt-4 text-5xl md:text-7xl" />
            <p className="mx-auto mt-5 max-w-xl text-lg font-light leading-8 text-muted">
              {t("about.firstText")}
            </p>
            <Link href="/visita" className="first-visit-cta">
              <span className="first-visit-copy">{t("about.firstCta")}</span>
              <span className="first-visit-pill">{t("about.firstPill")}</span>
            </Link>
          </section>
        </Rise>
        </div>
      </article>
    </SiteLayout>
  );
}

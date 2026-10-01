import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { WriteOnce } from "@/Components/motion/write-once";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import { PhotoRail } from "@/Components/site/photo-rail";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";

export default function About({
  settings,
  mediaOverrides,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const pastors = { ...media.aboutPastors, alt: media.aboutPastors.alt || settings.pastorsLabel };
  const washes = ["var(--amber)", "var(--dusk)", "var(--clay)", "var(--sage)"];

  return (
    <SiteLayout>
      <article className="about-page">
        <div className="page-wrap about-hero-wrap">
          <Rise>
            <header className="about-hero">
              <LeadTitle text={settings.aboutTitle} className="text-5xl md:text-7xl" />
              <blockquote className="about-quote">
                <p className="editorial">
                  <WriteOnce text={settings.aboutQuote} />
                </p>
              </blockquote>
            </header>
          </Rise>
        </div>

        <PhotoRail title="La casa" items={media.gallery} bare />

        <div className="page-wrap about-rest">
        <section className="about-pastors">
          <Rise from="left">
            <p className="kicker">Pastores</p>
            <LeadTitle as="h2" text={settings.pastorsLabel} className="mt-3 text-4xl md:text-6xl" />
            <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.aboutText}</p>
          </Rise>
          <Rise delay={140} from="right">
            <figure className="about-pastors-photo">
              <PageBand asset={pastors} />
            </figure>
          </Rise>
        </section>

        <div className="about-facts">
          {[
            ["Domingo", settings.sunday],
            ["Entre semana", settings.wednesday],
            ["Sede", settings.address],
          ].map(([label, value], index) => (
            <Rise key={label} delay={index * 90}>
              <div className="about-fact">
                <p className="kicker">{label}</p>
                <p className="editorial mt-3 text-2xl md:text-3xl">{value}</p>
              </div>
            </Rise>
          ))}
        </div>

        <section className="about-history">
          <Rise from="left">
            <p className="kicker">01 · Casa</p>
            <LeadTitle as="h2" lead="Nuestra" accent="historia" className="mt-5 text-5xl md:text-7xl" />
          </Rise>
          <Rise delay={120} from="right">
            <p className="about-history-text">{settings.history}</p>
          </Rise>
        </section>

        <Rise from="scale">
          <section className="about-vision">
            <p className="text-[11px] uppercase tracking-[0.32em] opacity-55">Visión</p>
            <p className="editorial mx-auto mt-6 max-w-4xl text-4xl italic leading-[1.12] md:text-6xl">
              “{settings.vision}”
            </p>
          </section>
        </Rise>

        <section className="about-values">
          <Rise>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="kicker">02 · Cómo vivimos</p>
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
          <section className="first-visit">
            <p className="kicker">Bienvenida</p>
            <LeadTitle text="¿Vienes por primera vez?" className="mt-4 text-5xl md:text-7xl" />
            <p className="mx-auto mt-5 max-w-xl text-lg font-light leading-8 text-muted">
              Si es tu primera vez en la iglesia queremos seguir en contacto contigo.
            </p>
            <Link href="/visita" className="first-visit-cta">
              <span className="first-visit-copy">Por favor llena este breve formulario.</span>
              <span className="first-visit-pill">Conoce más aquí</span>
            </Link>
          </section>
        </Rise>
        </div>
      </article>
    </SiteLayout>
  );
}

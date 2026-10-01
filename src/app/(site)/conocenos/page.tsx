import type { Metadata } from "next";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Conócenos" };

export default async function AboutPage() {
  const [settings, media] = await Promise.all([getSettings(), getSiteMedia()]);
  const pastors = { ...media.aboutPastors, alt: media.aboutPastors.alt || settings.pastorsLabel };
  return (
    <article className="page-wrap">
      <Rise>
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">{settings.aboutKicker}</p>
        <LeadTitle text={settings.aboutTitle} className="mt-4 max-w-4xl text-5xl md:text-7xl" />
      </Rise>
      <div className="mt-16 grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <Rise>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Pastores</p>
          <LeadTitle as="h2" text={settings.pastorsLabel} className="mt-3 text-4xl md:text-5xl" />
          <p className="mt-6 text-lg font-light leading-8 text-muted">{settings.aboutText}</p>
        </Rise>
        <Rise delay={120}>
          <PageBand asset={pastors} />
        </Rise>
      </div>
      <Rise>
        <section className="mt-24 grid items-start gap-10 border-t border-ink/10 pt-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <p className="kicker">01 · Casa</p>
            <LeadTitle as="h2" lead="Nuestra" accent="historia" className="mt-5 text-5xl md:text-7xl" />
          </div>
          <p className="max-w-2xl text-xl font-light leading-9 text-muted md:text-[1.35rem] md:leading-10">
            {settings.history}
          </p>
        </section>
      </Rise>

      <Rise delay={80}>
        <section className="swatch mt-16 px-7 py-16 text-center md:px-16 md:py-24" style={{ background: "var(--sage)", color: "#1f2024" }}>
          <p className="text-[11px] uppercase tracking-[0.32em] opacity-55">Visión</p>
          <p className="editorial mx-auto mt-6 max-w-4xl text-4xl italic leading-[1.12] md:text-6xl">
            “{settings.vision}”
          </p>
        </section>
      </Rise>

      <section className="mt-16">
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
          {settings.values.map((value, index) => {
            const washes = ["var(--amber)", "var(--dusk)", "var(--clay)", "var(--sage)"];
            return (
              <Rise key={value.title} delay={index * 70}>
                <article className="swatch flex h-full min-h-[240px] flex-col justify-between p-7 md:p-9" style={{ background: washes[index % washes.length], color: "#1f2024" }}>
                  <p className="text-[11px] uppercase tracking-[0.28em] opacity-50">0{index + 1}</p>
                  <div>
                    <h3 className="editorial text-4xl italic md:text-5xl">{value.title}</h3>
                    <p className="mt-4 max-w-md text-base leading-7 opacity-75">{value.text}</p>
                  </div>
                </article>
              </Rise>
            );
          })}
        </div>
      </section>
    </article>
  );
}

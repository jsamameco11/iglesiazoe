import type { Metadata } from "next";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Conócenos" };

export default async function AboutPage() {
  const [settings, media] = await Promise.all([getSettings(), getSiteMedia()]);
  const pastors = { ...media.aboutPastors, alt: media.aboutPastors.alt || settings.pastorsLabel };
  return (
    <article className="page-wrap">
      <Rise>
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Conócenos</p>
        <LeadTitle lead="Una iglesia local," accent="una sola familia." className="mt-4 max-w-4xl text-5xl md:text-7xl" />
      </Rise>
      <div className="mt-16 grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <Rise>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Pastores</p>
          <LeadTitle as="h2" text={settings.pastorsLabel} className="mt-3 text-4xl md:text-5xl" />
          <p className="mt-6 text-lg font-light leading-8 text-muted">{settings.aboutText}</p>
        </Rise>
        <Rise delay={120}>
          <MediaView asset={pastors} fit={pastors.kind === "image" ? "cutout" : "frame"} />
        </Rise>
      </div>
      <div className="mt-28 grid gap-16 md:grid-cols-2">
        <Rise>
          <LeadTitle as="h2" lead="Nuestra" accent="historia" className="text-4xl md:text-5xl" />
          <p className="mt-6 text-lg font-light leading-8 text-muted">{settings.history}</p>
        </Rise>
        <Rise delay={120}>
          <LeadTitle as="h2" accent="Visión" className="text-4xl md:text-5xl" />
          <p className="mt-6 text-lg font-light leading-8 text-muted">{settings.vision}</p>
        </Rise>
      </div>
      <section className="mt-28">
        <LeadTitle as="h2" lead="Valores" className="text-4xl md:text-5xl" />
        <div className="mt-12 grid gap-12 md:grid-cols-4">
          {settings.values.map((value, index) => (
            <Rise key={value.title} delay={index * 80}>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">0{index + 1}</p>
              <h3 className="mt-3 text-2xl font-light">{value.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{value.text}</p>
            </Rise>
          ))}
        </div>
      </section>
    </article>
  );
}

import Link from "next/link";
import { Rise } from "@/components/motion/rise";
import { HeroSplit } from "@/components/site/hero-film";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { MinistryCards, MinistryFeature } from "@/components/site/ministry-feature";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

export function MareaHome({
  settings,
  ministries,
  media,
}: {
  settings: SiteSettings;
  ministries: Ministry[];
  media: ResolvedMedia;
}) {
  return (
    <>
      <HeroSplit asset={media.hero}>
        <p className="kicker">{settings.city}</p>
        <LeadTitle text={settings.heroTitle} className="mt-5 max-w-xl text-4xl sm:text-6xl lg:text-[4.4rem]" />
        <p className="mt-6 max-w-md text-lg font-light leading-8 text-ink/70">{settings.heroSubtitle}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/visita" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">{settings.visitCta}</Link>
          <Link href="/bautismos" className="rounded-full px-6 py-3 text-sm font-medium ring-1 ring-ink/15">{settings.baptismCta}</Link>
        </div>
      </HeroSplit>

      <div className="stack px-4 py-12 md:px-8 lg:px-12">
        <Rise>
          <section className="swatch px-7 py-14 md:px-16 md:py-20" style={{ background: "var(--sage)", color: "#1f2024" }}>
            <p className="text-[11px] uppercase tracking-[0.28em] opacity-55">{settings.pastorsLabel}</p>
            <p className="editorial mt-5 max-w-4xl text-4xl italic leading-[1.12] md:text-6xl">“{settings.aboutQuote}”</p>
          </section>
        </Rise>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Domingo", settings.sunday],
            ["Entre semana", settings.wednesday],
            ["Dirección", settings.address],
          ].map(([label, value]) => (
            <Rise key={label}>
              <div className="panel h-full px-7 py-8">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">{label}</p>
                <p className="editorial mt-4 text-3xl">{value}</p>
              </div>
            </Rise>
          ))}
        </div>

        <Rise>
          <section className="panel grid items-center gap-8 p-4 md:grid-cols-[0.95fr_1.05fr] md:p-6">
            <MediaView asset={media.mareaFamily} />
            <div className="px-4 py-6 md:px-8">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted">{settings.homeFamilyKicker}</p>
              <LeadTitle as="h2" text={settings.homeFamilyTitle} className="mt-3 text-5xl md:text-6xl" />
              <p className="mt-5 max-w-md text-lg leading-8 text-muted">{settings.aboutText}</p>
            </div>
          </section>
        </Rise>

        <MinistryFeature settings={settings} ministries={ministries} media={media} />
        <MinistryCards ministries={ministries} media={media} />

        <div className="grid gap-4 md:grid-cols-3">
          <Rise>
            <Link href="/visita" className="swatch block h-full p-8" style={{ background: "color-mix(in srgb, var(--sage) 74%, white)", color: "#1f2024" }}>
              <h3 className="headline text-4xl italic">{settings.ctaVisitTitle}</h3>
              <p className="mt-4 leading-7 opacity-75">{settings.ctaVisitText}</p>
            </Link>
          </Rise>
          <Rise>
            <Link href="/bautismos" className="swatch block h-full p-8" style={{ background: "color-mix(in srgb, var(--dusk) 74%, white)", color: "#1f2024" }}>
              <h3 className="headline text-4xl italic">{settings.ctaBaptismTitle}</h3>
              <p className="mt-4 leading-7 opacity-75">{settings.ctaBaptismText}</p>
            </Link>
          </Rise>
          <Rise>
            <Link href="/dar" className="swatch block h-full p-8" style={{ background: "color-mix(in srgb, var(--clay) 74%, white)", color: "#1f2024" }}>
              <h3 className="headline text-4xl italic">Generosidad</h3>
              <p className="mt-4 leading-7 opacity-75">{settings.giveLead}</p>
            </Link>
          </Rise>
        </div>
      </div>
    </>
  );
}

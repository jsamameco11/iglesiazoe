import Link from "next/link";
import { Rise } from "@/components/motion/rise";
import { HeroFilm } from "@/components/site/hero-film";
import { PhotoRail } from "@/components/site/photo-rail";
import { MinistryCards, MinistryFeature } from "@/components/site/ministry-feature";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

export function AireHome({
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
      <HeroFilm asset={media.hero}>
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white">{settings.city}</p>
        <h1 className="display mt-4 max-w-4xl text-5xl text-white sm:text-7xl" style={{ color: "#fff" }}>{settings.heroTitle}</h1>
        <p className="mt-5 max-w-xl text-lg font-light leading-8 text-white/85">{settings.heroSubtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/visita" className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink">{settings.visitCta}</Link>
          <Link href="/predicas" className="rounded-full px-6 py-3 text-sm font-medium text-white ring-1 ring-white/50">{settings.sermonsCta}</Link>
        </div>
      </HeroFilm>

      <PhotoRail title={settings.railTitle} text={settings.railText} items={media.gallery} />

      <div className="stack px-4 py-8 md:px-8 lg:px-12">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Domingo", settings.sunday, "var(--sage)"],
            ["Entre semana", settings.wednesday, "var(--amber)"],
            ["Estamos en", settings.address, "var(--dusk)"],
          ].map(([label, value, color], index) => (
            <Rise key={label} delay={index * 90}>
              <div className="swatch h-full px-7 py-8" style={{ background: color, color: "#1f2024" }}>
                <p className="text-[11px] uppercase tracking-[0.24em] opacity-60">{label}</p>
                <p className="editorial mt-4 text-3xl italic">{value}</p>
              </div>
            </Rise>
          ))}
        </div>

        <MinistryFeature settings={settings} ministries={ministries} media={media} />
        <MinistryCards ministries={ministries} media={media} />

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["/visita", settings.ctaVisitTitle, settings.ctaVisitText, "var(--sage)"],
            ["/bautismos", settings.ctaBaptismTitle, settings.ctaBaptismText, "var(--dusk)"],
            ["/contacto", settings.ctaPrayerTitle, settings.ctaPrayerText, "var(--clay)"],
          ].map(([href, title, text, color], index) => (
            <Rise key={href} delay={index * 90}>
              <Link href={href} className="swatch block h-full p-8" style={{ background: `color-mix(in srgb, ${color} 74%, white)`, color: "#1f2024" }}>
                <h2 className="headline text-[1.85rem] md:text-[2.15rem]">{title}</h2>
                <p className="mt-4 text-[15px] leading-7 opacity-70">{text}</p>
              </Link>
            </Rise>
          ))}
        </div>
      </div>
    </>
  );
}

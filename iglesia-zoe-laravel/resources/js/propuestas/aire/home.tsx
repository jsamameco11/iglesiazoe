import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { HeroFilm } from "@/Components/site/hero-film";
import { MediaView } from "@/Components/site/media-view";
import { MinistryFeature } from "@/Components/site/ministry-feature";
import { PhotoRail } from "@/Components/site/photo-rail";
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
      <HeroFilm asset={media.hero} sunday={settings.sunday} wednesday={settings.wednesday}>
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white">{settings.city}</p>
        <h1 className="display mt-3 max-w-4xl text-[2.35rem] leading-[1.05] text-white sm:mt-4 sm:text-5xl md:text-6xl lg:text-7xl" style={{ color: "#fff" }}>{settings.heroTitle}</h1>
        <p className="mt-4 max-w-xl text-[15px] font-light leading-7 text-white/85 sm:mt-5 sm:text-lg sm:leading-8">{settings.heroSubtitle}</p>
        <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
          <Link href="/visita" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white sm:px-6 sm:py-3">{settings.visitCta}</Link>
          <Link href="/predicas" className="rounded-full px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/50 sm:px-6 sm:py-3">{settings.sermonsCta}</Link>
        </div>
      </HeroFilm>

      <PhotoRail title={settings.railTitle} text={settings.railText} items={media.gallery} />

      <Rise>
        <section className="home-band">
          <div className="home-band-copy">
            <h2 className="editorial text-5xl italic leading-[1.05] text-white sm:text-6xl">
              Nuestros horarios
            </h2>
            <dl className="mt-8 space-y-4 text-white/85">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.22em] text-white/45">Domingo</dt>
                <dd className="mt-1 text-lg">{settings.sunday}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.22em] text-white/45">Entre semana</dt>
                <dd className="mt-1 text-lg">{settings.wednesday}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.22em] text-white/45">Sede</dt>
                <dd className="mt-1 text-lg">{settings.address}</dd>
              </div>
            </dl>
            <Link href="/visita" className="mt-8 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
              {settings.visitCta}
            </Link>
          </div>
          <div className="home-band-photo">
            <MediaView asset={media.gallery[2] || media.gallery[0] || media.hero} fit="cover" />
          </div>
        </section>
      </Rise>

      <div className="stack px-4 py-8 md:px-8 lg:px-12">

        <MinistryFeature settings={settings} ministries={ministries} media={media} />

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["/visita", settings.ctaVisitTitle, settings.ctaVisitText, "var(--sage)"],
            ["/bautismos", settings.ctaBaptismTitle, settings.ctaBaptismText, "var(--dusk)"],
            ["/contacto", settings.ctaPrayerTitle, settings.ctaPrayerText, "var(--clay)"],
          ].map(([href, title, text, color], index) => (
            <Rise key={href} delay={index * 110} from={index === 0 ? "left" : index === 2 ? "right" : "up"}>
              <Link href={href} className="swatch block h-full p-8" style={{ background: color }}>
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

import { Link } from "@inertiajs/react";
import { BibleReveal } from "@/Components/motion/bible-reveal";
import { Rise } from "@/Components/motion/rise";
import { HeroSplit } from "@/Components/site/hero-film";
import { LeadTitle } from "@/Components/site/lead-title";
import { MinistryFeature } from "@/Components/site/ministry-feature";
import { MediaView } from "@/Components/site/media-view";
import { readCopy } from "@/lib/copy";
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
      <HeroSplit asset={media.hero} sunday={settings.sunday} wednesday={settings.wednesday}>
        <p className="kicker">{settings.city}</p>
        <LeadTitle text={settings.heroTitle} className="mt-4 max-w-xl text-[2.15rem] sm:mt-5 sm:text-6xl lg:text-[4.4rem]" />
        <p className="mt-5 max-w-md text-[15px] font-light leading-7 text-ink/70 sm:mt-6 sm:text-lg sm:leading-8">{settings.heroSubtitle}</p>
        <div className="mt-7 flex flex-wrap gap-3 sm:mt-9">
          <Link href="/visita" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white sm:px-6 sm:py-3">{settings.visitCta}</Link>
          <Link href="/bautismos" className="rounded-full px-5 py-2.5 text-sm font-medium ring-1 ring-ink/15 sm:px-6 sm:py-3">{settings.baptismCta}</Link>
        </div>
      </HeroSplit>

      <section className="luz-franja luz-quote">
        <Rise>
          <div className="luz-quote-copy">
            <p className="luz-kicker">{settings.pastorsLabel}</p>
            <p className="editorial mt-5 max-w-3xl text-4xl italic leading-[1.12] md:text-[3.35rem]">{settings.aboutQuote}</p>
          </div>
        </Rise>
        <BibleReveal />
      </section>

      <Rise>
        <section className="home-band">
          <div className="home-band-copy">
            <p className="luz-kicker luz-kicker-light">{readCopy(settings, "home.scheduleKicker")}</p>
            <h2 className="editorial mt-4 text-5xl italic leading-[1.05] text-white sm:text-6xl">{readCopy(settings, "home.scheduleTitleLuz")}</h2>
            <dl className="mt-8 space-y-4 text-white/85">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.22em] text-white/45">{readCopy(settings, "facts.sunday")}</dt>
                <dd className="mt-1 text-lg">{settings.sunday}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.22em] text-white/45">{readCopy(settings, "facts.week")}</dt>
                <dd className="mt-1 text-lg">{settings.wednesday}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.22em] text-white/45">{readCopy(settings, "facts.place")}</dt>
                <dd className="mt-1 text-lg">{settings.address}</dd>
              </div>
            </dl>
            <Link href="/visita" className="mt-8 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
              {settings.visitCta}
            </Link>
          </div>
          <div className="home-band-photo">
            <MediaView asset={media.mareaCulto} fit="cover" />
          </div>
        </section>
      </Rise>

      <Rise>
        <section className="luz-franja luz-family">
          <div className="luz-family-photo">
            <MediaView asset={media.mareaFamily} fit="cover" />
          </div>
          <div className="luz-family-copy">
            <p className="luz-kicker">{settings.homeFamilyKicker}</p>
            <LeadTitle as="h2" text={settings.homeFamilyTitle} className="mt-3 text-5xl md:text-6xl" />
            <p className="mt-5 max-w-md text-lg leading-8 text-muted">{settings.aboutText}</p>
          </div>
        </section>
      </Rise>

      <MinistryFeature settings={settings} ministries={ministries} media={media} />

      <div className="luz-cta">
        <Rise from="left">
          <Link href="/visita" className="luz-cta-cell" style={{ background: "var(--sage)" }}>
            <h3 className="headline text-4xl italic">{settings.ctaVisitTitle}</h3>
            <p className="mt-4 max-w-sm leading-7 opacity-75">{settings.ctaVisitText}</p>
          </Link>
        </Rise>
        <Rise delay={90}>
          <Link href="/bautismos" className="luz-cta-cell" style={{ background: "var(--dusk)" }}>
            <h3 className="headline text-4xl italic">{settings.ctaBaptismTitle}</h3>
            <p className="mt-4 max-w-sm leading-7 opacity-75">{settings.ctaBaptismText}</p>
          </Link>
        </Rise>
        <Rise delay={180} from="right">
          <Link href="/dar" className="luz-cta-cell" style={{ background: "var(--clay)" }}>
            <h3 className="headline text-4xl italic">{readCopy(settings, "home.giveCardTitle")}</h3>
            <p className="mt-4 max-w-sm leading-7 opacity-75">{settings.giveLead}</p>
          </Link>
        </Rise>
      </div>
    </>
  );
}

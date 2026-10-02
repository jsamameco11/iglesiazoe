import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaView, PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { talkUrlOf } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";

export default function ServerRoute({
  settings,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const levels = settings.routeLevels.map((level, index) => ({ ...level, slot: level.slot ?? index + 1 }));

  return (
    <SiteLayout>
      <article>
        <div className="page-wrap flush-bottom">
          <Rise>
            <PageIntro skin={skin} kicker={t("route.kicker")} title={settings.routeTitle} media={<PageBand asset={media.routeCover} />}>
              <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.routeText}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-ink">
                  {levels.length} {t("route.levelsKicker").toLowerCase()}
                </span>
                <a href="#niveles" className="home-link">
                  {t("route.levelsTitle")} ↓
                </a>
              </div>
            </PageIntro>
          </Rise>
        </div>

        <section id="niveles" className="scroll-mt-24 px-6 py-24 md:px-16 md:py-32">
          <div className="section-wrap">
            <Rise className="max-w-2xl">
              <p className="kicker">{t("route.levelsKicker")}</p>
              <LeadTitle as="h2" text={t("route.levelsTitle")} className="mt-4 text-4xl leading-[1.05] md:text-6xl" />
            </Rise>
            <ol className="route-track mt-16">
              {levels.map((level, index) => {
                const asset = media.route(level.slot);
                return (
                  <li key={`${level.slot}-${level.title}`} className="route-level">
                    <span className="route-node" aria-hidden>
                      {index + 1}
                    </span>
                    <div className="route-photo">{asset.src ? <MediaView asset={asset} fit="raw" /> : null}</div>
                    <div>
                      <p className="kicker">
                        {t("route.level")} {index + 1}
                      </p>
                      <h3 className="editorial mt-3 text-3xl leading-tight md:text-4xl">{level.title}</h3>
                      {level.text ? <p className="mt-4 max-w-md text-[1.02rem] font-light leading-7">{level.text}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="ink-band px-6 py-20 md:px-16 md:py-24">
          <Rise className="section-wrap flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="editorial text-4xl leading-[1.05] text-white md:text-5xl">{t("route.ctaTitle")}</h2>
              <p className="mt-4 text-base font-light leading-7 text-white/70">{t("route.ctaText")}</p>
            </div>
            <a href={talkUrlOf(settings, t("route.message"))} target="_blank" rel="noreferrer" className="btn-accent rounded-full px-6 py-3 text-sm font-semibold">
              {t("route.cta")} →
            </a>
          </Rise>
        </section>
      </article>
    </SiteLayout>
  );
}

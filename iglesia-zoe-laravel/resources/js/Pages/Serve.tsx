import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import { ServeForm } from "@/Components/site/serve-form";
import { photoFallback, SERVE_FALLBACK } from "@/Components/site/serve-rail";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { ServeArea, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";

export default function Serve({
  settings,
  serveAreas,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  serveAreas: ServeArea[];
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const reasons = t("serve.whyPoints").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const areas = serveAreas.filter((area) => area.accepts_volunteers);
  const also = serveAreas.filter((area) => !area.accepts_volunteers);
  const firstTeam = areas.reduce<number[]>((starts, _area, index) => [...starts, index ? starts[index - 1] + areas[index - 1].teams.length : 1], []);

  return (
    <SiteLayout>
      <article>
        <div className="page-wrap flush-bottom">
          <Rise>
            <PageIntro skin={skin} kicker={t("serve.kicker")} title={settings.serveTitle} media={<PageBand asset={media.serveCover} />}>
              <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.serveText}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#registro" className="btn-accent inline-flex rounded-full px-6 py-3 text-sm font-semibold">{t("serve.register")}</a>
                <a href="#areas" className="inline-flex rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/40">
                  {t("serve.areasCta")} ↓
                </a>
              </div>
            </PageIntro>
          </Rise>
        </div>

        <section {...section("why", "Por qué servir")} className="px-6 pb-6 pt-24 md:px-16 md:pt-28">
          <div className="section-wrap grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Rise>
              <p className="kicker">{t("serve.whyKicker")}</p>
              <LeadTitle as="h2" text={t("serve.whyTitle")} className="mt-4 text-4xl leading-[1.05] md:text-5xl" />
            </Rise>
            <ul className="grid gap-3 sm:grid-cols-2">
              {reasons.map((reason, index) => (
                <li key={index} className="serve-reason">
                  <span className="serve-reason-mark" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <p>{reason}</p>
                </li>
              ))}
            </ul>
          </div>
          <Rise className="section-wrap">
            <figure className="serve-quote">
              <blockquote className="editorial">“{t("serve.quote")}”</blockquote>
              <figcaption>{t("serve.quoteNote")}</figcaption>
            </figure>
          </Rise>
        </section>

        {areas.length > 0 && (
          <section {...section("areas", "Áreas de servicio")} id="areas" className="scroll-mt-24 px-6 pb-24 pt-16 md:px-16">
            <div className="section-wrap">
              <Rise>
                <p className="kicker">{t("serve.areasKicker")}</p>
                <LeadTitle as="h2" text={t("serve.areasTitle")} className="mt-4 max-w-3xl text-4xl leading-[1.05] md:text-5xl" />
              </Rise>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {areas.map((area, index) => (
                  <Link key={area.id} href={`/involucrate/${area.slug}`} className="serve-card group">
                    <img src={area.image || SERVE_FALLBACK} alt={area.name} loading="lazy" onError={photoFallback} />
                    <span className="serve-card-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="serve-card-body">
                      <h3 className="text-[1.65rem] font-medium leading-tight tracking-[-0.03em] text-white">{area.name}</h3>
                      {area.tagline ? <p className="editorial mt-1 text-lg italic text-white/85">{area.tagline}</p> : null}
                      {area.teams.length > 0 && (
                        <ol className="serve-teams">
                          {area.teams.map((team, position) => <li key={team}>{firstTeam[index] + position}. {team}</li>)}
                        </ol>
                      )}
                      <span className="serve-join text-white">{t("serve.areaMore")} →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {also.length > 0 && (
          <section {...section("also", "También puedes servir")} className="px-6 pb-24 md:px-16">
            <div className="section-wrap">
              <Rise>
                <p className="kicker">{t("serve.alsoKicker")}</p>
                <h2 className="editorial mt-3 text-3xl md:text-4xl">{t("serve.alsoTitle")}</h2>
              </Rise>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {also.map((area) => (
                  <Link key={area.id} href={`/involucrate/${area.slug}`} className="serve-also group">
                    <img src={area.image || SERVE_FALLBACK} alt="" loading="lazy" onError={photoFallback} />
                    <span className="min-w-0">
                      <span className="block text-[1.35rem] font-medium tracking-[-0.03em] text-ink">{area.name}</span>
                      {area.tagline ? <span className="editorial mt-0.5 block text-lg italic text-muted">{area.tagline}</span> : null}
                      <span className="serve-also-link">{t("serve.areaMore")} →</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {areas.length > 0 && (
          <section {...section("form", "Formulario de inscripción")} id="registro" className="soft-band scroll-mt-20 px-6 py-20 md:px-16 md:py-24">
            <div className="section-wrap grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <Rise>
                <p className="kicker">{t("serve.formKicker")}</p>
                <LeadTitle as="h2" text={t("serve.formTitle")} className="mt-4 text-4xl leading-[1.05] md:text-5xl" />
                <p className="mt-5 max-w-md text-[15px] leading-7 text-muted">{t("serve.formText")}</p>
              </Rise>
              <div className="rounded-[1.75rem] bg-card p-6 shadow-[0_30px_70px_-50px_rgba(20,16,12,0.5)] md:p-9">
                <ServeForm areas={areas} />
              </div>
            </div>
          </section>
        )}

        <section {...section("route", "La Ruta del Servidor")} className="ink-band px-6 py-20 md:px-16 md:py-24">
          <Rise className="section-wrap flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="kicker">{t("nav.route")}</p>
              <h2 className="editorial mt-4 max-w-2xl text-4xl leading-[1.05] text-white md:text-5xl">{t("serve.routeTitle")}</h2>
            </div>
            <Link href="/ruta-del-servidor" className="btn-accent rounded-full px-6 py-3 text-sm font-semibold">
              {t("serve.routeCta")} →
            </Link>
          </Rise>
        </section>
      </article>
    </SiteLayout>
  );
}

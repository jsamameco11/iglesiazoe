import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { Paragraphs } from "@/Components/site/home/section";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageIntro } from "@/Components/site/page-intro";
import { ServeForm } from "@/Components/site/serve-form";
import { photoFallback, SERVE_FALLBACK } from "@/Components/site/serve-rail";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import type { ServeArea as Area, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";

function AreaButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  const className = primary
    ? "btn-accent inline-flex rounded-full px-6 py-3 text-sm font-semibold"
    : "inline-flex rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/40";
  return href.startsWith("/") ? (
    <Link href={href} className={className}>{label} →</Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={className}>{label} ↗</a>
  );
}

export default function ServeArea({
  area,
  serveAreas,
  settings,
  skin,
}: {
  area: Area;
  serveAreas: Area[];
  settings: SiteSettings;
  skin: "aire" | "marea";
}) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const others = serveAreas.filter((item) => item.id !== area.id);
  const volunteerAreas = serveAreas.filter((item) => item.accepts_volunteers);
  const signup = area.accepts_volunteers;
  const extra = area.cta_label && area.cta_url ? { href: area.cta_url, label: area.cta_label } : null;

  return (
    <SiteLayout>
      <article>
        <div className="page-wrap flush-bottom">
          <Rise>
            <Link href="/involucrate" className="text-sm text-muted transition hover:text-ink">← {t("serve.back")}</Link>
          </Rise>
          <div className="mt-10">
            <Rise>
              <PageIntro
                skin={skin}
                kicker={t("serve.kicker")}
                title={area.name}
                media={
                  <figure className="serve-area-photo m-0">
                    <img src={area.image || SERVE_FALLBACK} alt={area.name} onError={photoFallback} />
                  </figure>
                }
              >
                {area.tagline ? <p className="editorial mt-4 text-2xl italic text-ink md:text-3xl">{area.tagline}</p> : null}
                {area.summary ? <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{area.summary}</p> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  {signup ? (
                    <a href="#registro" className="btn-accent inline-flex rounded-full px-6 py-3 text-sm font-semibold">
                      {t("serve.areaRegister").replace("{area}", area.name)}
                    </a>
                  ) : null}
                  {extra ? <AreaButton href={extra.href} label={extra.label} primary={!signup} /> : null}
                </div>
              </PageIntro>
            </Rise>
          </div>
        </div>

        {(area.body || area.teams.length > 0) && (
          <section {...section("about", "Sobre el área")} className="px-6 pb-8 pt-24 md:px-16 md:pt-28">
            <div className="section-wrap grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              {area.body ? (
                <Rise>
                  <Paragraphs text={area.body} className="max-w-2xl text-[1.08rem] leading-8 text-ink" />
                </Rise>
              ) : <span />}
              {area.teams.length > 0 && (
                <Rise>
                  <p className="kicker">{t("serve.teamsKicker")}</p>
                  <ol className="mt-5 grid gap-3">
                    {area.teams.map((team, index) => (
                      <li key={team} className="serve-team">
                        <span className="serve-team-num">{String(index + 1).padStart(2, "0")}</span>
                        <span className="text-[1.15rem] font-medium tracking-[-0.02em] text-ink">{team}</span>
                      </li>
                    ))}
                  </ol>
                </Rise>
              )}
            </div>
          </section>
        )}

        {signup ? (
          <section {...section("form", "Formulario de inscripción")} id="registro" className="soft-band mt-16 scroll-mt-20 px-6 py-20 md:px-16 md:py-24">
            <div className="section-wrap grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <Rise>
                <p className="kicker">{t("serve.formKicker")}</p>
                <LeadTitle as="h2" text={t("serve.formTitle")} className="mt-4 text-4xl leading-[1.05] md:text-5xl" />
                <p className="mt-5 max-w-md text-[15px] leading-7 text-muted">{t("serve.formText")}</p>
              </Rise>
              <div className="rounded-[1.75rem] bg-card p-6 shadow-[0_30px_70px_-50px_rgba(20,16,12,0.5)] md:p-9">
                <ServeForm key={area.id} areas={volunteerAreas} initialArea={area.id} />
              </div>
            </div>
          </section>
        ) : (
          <section {...section("join", "Cómo unirte")} className="ink-band mt-16 px-6 py-20 md:px-16 md:py-24">
            <Rise className="section-wrap flex flex-wrap items-end justify-between gap-8">
              <div>
                <p className="kicker">{area.name}</p>
                <h2 className="editorial mt-4 max-w-2xl text-4xl leading-[1.05] text-white md:text-5xl">{area.tagline || area.name}</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/75">{t("serve.noSignup")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {extra ? <AreaButton href={extra.href} label={extra.label} primary /> : null}
                <Link href="/involucrate#registro" className="inline-flex rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/70">
                  {t("serve.register")} →
                </Link>
              </div>
            </Rise>
          </section>
        )}

        {others.length > 0 && (
          <section {...section("others", "Otras áreas")} className="px-6 py-20 md:px-16 md:py-24">
            <div className="section-wrap">
              <Rise className="flex flex-wrap items-end justify-between gap-6">
                <h2 className="editorial text-3xl md:text-4xl">{t("serve.otherAreas")}</h2>
                <Link href="/involucrate#areas" className="home-link">{t("serve.areasCta")} →</Link>
              </Rise>
              <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {others.map((item) => (
                  <Link key={item.id} href={`/involucrate/${item.slug}`} className="serve-mini">
                    <img src={item.image || SERVE_FALLBACK} alt="" loading="lazy" onError={photoFallback} />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </SiteLayout>
  );
}

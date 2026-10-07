import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { ClassroomPreview } from "@/Components/classroom/preview";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaSlides, PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { talkUrlOf } from "@/lib/social";
import { classLine, plural, scheduleLabel, type StudyLevel } from "@/lib/studies";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

const FEATURES = [
  { title: "Tus notas", text: "Cada tarea y examen, con tu promedio al día." },
  { title: "Tu semana", text: "En qué semana vas y cuándo termina tu nivel." },
  { title: "Tu horario", text: "Día, hora y lugar de la próxima clase." },
  { title: "Lecturas en PDF", text: "El material de cada semana, listo para leer." },
  { title: "Avisos de la iglesia", text: "Te llegan apenas ingresas al aula." },
  { title: "Palabra de ánimo", text: "Un versículo para cada día del camino." },
];

export default function ServerRoute({
  settings,
  mediaOverrides,
  skin,
  studyLevels,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
  studyLevels: StudyLevel[];
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const firstClass = studyLevels.find((level) => level.schedule.day)?.schedule ?? studyLevels[0]?.schedule;

  return (
    <SiteLayout>
      <article>
        <div className="page-wrap flush-bottom">
          <Rise>
            <PageIntro skin={skin} kicker={pages.kicker("route")} title={settings.routeTitle} media={<PageBand asset={media.routeCover} />}>
              <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{settings.routeText}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-ink">{plural(studyLevels.length, "nivel", "niveles")}</span>
                {firstClass ? <span className="rounded-full border border-ink/12 px-4 py-2 text-sm font-medium text-ink">{classLine(firstClass)}</span> : null}
                <Link href="/estudios/acceso" className="btn-accent rounded-full px-5 py-2 text-sm font-semibold">
                  {pages.name("classroom")} →
                </Link>
                <a href="#niveles" className="home-link">
                  {t("route.levelsTitle")} ↓
                </a>
              </div>
            </PageIntro>
          </Rise>
        </div>

        <section {...section("levels", "Niveles")} id="niveles" className="scroll-mt-24 px-6 py-24 md:px-16 md:py-32">
          <div className="section-wrap">
            <Rise className="max-w-2xl">
              <p className="kicker">{pages.section("route", "levels")}</p>
              <LeadTitle as="h2" text={t("route.levelsTitle")} className="mt-4 text-4xl leading-[1.05] md:text-6xl" />
            </Rise>
            <ol className="route-track mt-16">
              {studyLevels.map((level, index) => {
                const asset = media.route(index + 1);
                const { schedule } = level;
                return (
                  <li key={level.id} className="route-level">
                    <span className="route-node" aria-hidden>
                      {index + 1}
                    </span>
                    <div className="route-photo">{asset.src ? <MediaSlides asset={asset} fit="raw" /> : null}</div>
                    <div>
                      <p className="kicker">
                        {t("route.level")} {index + 1}
                      </p>
                      <h3 className="editorial mt-3 text-3xl leading-tight md:text-4xl">{level.name}</h3>
                      {level.summary ? <p className="mt-4 max-w-md text-[1.02rem] font-light leading-7">{level.summary}</p> : null}
                      <div className="route-meta">
                        <span>{classLine(schedule)}</span>
                        <span>{plural(schedule.weeks, "semana", "semanas")}</span>
                        <span data-state={schedule.state}>{scheduleLabel(schedule)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section {...section("classroom", "Aula virtual")} id="aula" className="route-access scroll-mt-24 px-6 py-16 sm:py-24 md:px-16 md:py-28">
          <div className="section-wrap grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 xl:gap-20">
            <Rise className="min-w-0">
              <p className="kicker">{pages.section("route", "access")}</p>
              <h2 className="editorial mt-4 text-4xl leading-[1.05] text-white md:text-5xl">{t("route.accessTitle")}</h2>
              <p className="mt-4 max-w-lg text-base font-light leading-7 text-white/70">{t("route.accessText")}</p>
              <ul className="route-access-list mt-9">
                {FEATURES.map((feature, index) => (
                  <li key={feature.title} style={{ "--i": index } as React.CSSProperties}>
                    <span className="route-access-check" aria-hidden>
                      ✓
                    </span>
                    <span>
                      <b>{feature.title}</b>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href="/estudios/acceso" className="btn-accent rounded-full px-7 py-3.5 text-[15px] font-semibold">
                  {t("route.accessButton")} →
                </Link>
                <p className="max-w-xs text-[13px] leading-5 text-white/55">{t("route.accessHelp")}</p>
              </div>
            </Rise>
            <Rise from="right" delay={120} className="min-w-0">
              <ClassroomPreview levels={studyLevels.map((level) => level.name)} />
            </Rise>
          </div>
        </section>

        <section {...section("cta", "Invitación final")} className="px-6 py-16 sm:py-20 md:px-16 md:py-24">
          <Rise className="section-wrap flex flex-col items-start gap-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-2xl">
              <h2 className="editorial text-[clamp(2rem,6vw,3rem)] leading-[1.05] md:text-5xl">{t("route.ctaTitle")}</h2>
              <p className="mt-4 text-base font-light leading-7 text-muted">{t("route.ctaText")}</p>
            </div>
            <a href={talkUrlOf(settings, t("route.message"))} target="_blank" rel="noreferrer" className="btn-accent inline-flex w-full shrink-0 items-center justify-center rounded-full px-6 py-3.5 text-center text-sm font-semibold sm:w-auto">
              {t("route.cta")} →
            </a>
          </Rise>
        </section>
      </article>
    </SiteLayout>
  );
}

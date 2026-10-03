import { Link } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { GamePage, Meter } from "@/Components/games/ui";
import { lingoProgress } from "@/lib/games";

type Lesson = { id: string; title: string; xp: number; exercises: number };
type Unit = { id: string; title: string; description: string | null; lessons: Lesson[] };
type Path = { slug: string; title: string; description: string | null; units: Unit[] };

/** A path with its units; each lesson opens once the one before it is passed. */
export default function LingoPath({ path }: { path: Path }) {
  const [progress] = useState(lingoProgress.all);
  const sequence = path.units.flatMap((unit) => unit.lessons);
  const passed = sequence.filter((lesson) => lingoProgress.passed(progress[lesson.id])).length;
  const isOpen = (lesson: Lesson) => {
    const position = sequence.findIndex((item) => item.id === lesson.id);
    return position === 0 || lingoProgress.passed(progress[sequence[position - 1]?.id]) || lingoProgress.passed(progress[lesson.id]);
  };
  const nextUp = sequence.find((lesson) => isOpen(lesson) && !lingoProgress.passed(progress[lesson.id]));

  return (
    <GamePage kicker="LINGOBIBLE · Ruta" title={path.title} text={path.description ?? undefined} back={{ href: "/juegos/lingobible", label: "Todas las rutas" }}>
      <Rise className="mt-10 flex flex-wrap items-center gap-5 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
        <div className="min-w-56 flex-1">
          <p className="text-sm font-semibold text-ink">
            {passed} de {sequence.length} lecciones completadas
          </p>
          <Meter value={passed} total={sequence.length} className="mt-3" />
        </div>
        {nextUp ? (
          <Link href={`/juegos/lingobible/${path.slug}/${nextUp.id}`} className="btn-accent inline-flex rounded-full px-6 py-3 text-sm font-semibold">
            {passed ? "Continuar" : "Empezar"}: {nextUp.title} →
          </Link>
        ) : (
          <span className="rounded-full bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-900">Ruta completa ✓</span>
        )}
      </Rise>

      <div className="mt-12 grid gap-10">
        {path.units.map((unit, unitIndex) => (
          <Rise key={unit.id}>
            <section>
              <p className="kicker">Unidad {unitIndex + 1}</p>
              <h2 className="editorial mt-2 text-3xl text-ink">{unit.title}</h2>
              {unit.description ? <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">{unit.description}</p> : null}
              <ol className="mt-6 grid gap-3 md:grid-cols-2">
                {unit.lessons.map((lesson) => {
                  const mine = progress[lesson.id];
                  const open = isOpen(lesson);
                  const done = lingoProgress.passed(mine);
                  const body = (
                    <>
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : open ? "bg-accent text-white" : "bg-sage text-muted"}`}>
                        {done ? "✓" : open ? sequence.indexOf(lesson) + 1 : <LockIcon />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{lesson.title}</span>
                        <span className="text-xs text-muted">
                          {lesson.exercises} preguntas · {lesson.xp} XP
                          {mine ? ` · mejor ${mine.best}%` : ""}
                        </span>
                      </span>
                      {mine?.stars ? (
                        <span className="text-sm tracking-[0.1em] text-accent" aria-label={`${mine.stars} estrellas`}>
                          {"★".repeat(mine.stars)}
                          <span className="text-line">{"★".repeat(3 - mine.stars)}</span>
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={lesson.id}>
                      {open ? (
                        <Link href={`/juegos/lingobible/${path.slug}/${lesson.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-card px-4 py-4 transition hover:-translate-y-0.5 hover:border-ink/30">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line px-4 py-4 opacity-70" title="Aprueba la lección anterior para abrirla">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          </Rise>
        ))}
      </div>
    </GamePage>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Bloqueada">
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" strokeLinecap="round" />
    </svg>
  );
}

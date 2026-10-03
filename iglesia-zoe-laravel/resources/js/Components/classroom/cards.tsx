import { useMemo, useState, type CSSProperties } from "react";
import { useSitePages } from "@/lib/site-pages";
import type { StudyLevel, StudyVerse } from "@/lib/studies";
import type { RouteStep, Grade, Summary } from "./types";
import { useStored } from "./hooks";

export function VerseCard({ verses, username, today }: { verses: StudyVerse[]; username: string; today: string }) {
  const start = useMemo(() => {
    const date = new Date(`${today}T12:00:00`);
    const day = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    return verses.length ? day % verses.length : 0;
  }, [today, verses.length]);
  const [index, setIndex] = useState(start);
  const [amen, setAmen] = useStored(`zoe-aula-amen-${username}`);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);
  const verse = verses[index % Math.max(verses.length, 1)];

  if (!verse) {
    return (
      <div className="aula-verse">
        <p className="aula-kicker text-ink/50">Palabra para hoy</p>
        <p className="mt-4 text-lg leading-8">Pronto encontrarás aquí versículos para animarte cada día.</p>
      </div>
    );
  }

  const said = amen.includes(verse.id);
  const text = verse.reference ? `“${verse.text}” — ${verse.reference}` : verse.text;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: `${text}\n\nIglesia Cristiana Zoe` });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The person closed the share sheet.
    }
  }

  return (
    <div className="aula-verse">
      <div className="flex items-center justify-between gap-3">
        <p className="aula-kicker text-ink/50">{verse.reference ? "Versículo para hoy" : "Palabra de ánimo"}</p>
        {verses.length > 1 ? <p className="text-xs tabular-nums text-muted">{(index % verses.length) + 1} / {verses.length}</p> : null}
      </div>
      <blockquote key={verse.id} className="aula-verse-text">
        {verse.text.split(/\s+/).map((word, position) => (
          <span key={position} style={{ "--w": position } as CSSProperties}>{word} </span>
        ))}
      </blockquote>
      {verse.reference ? <p key={`${verse.id}-ref`} className="aula-verse-ref">{verse.reference}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
        <button
          type="button"
          onClick={() => {
            if (!said) {
              setAmen([...amen, verse.id]);
              setBurst((value) => value + 1);
            }
          }}
          className="aula-amen"
          data-on={said || undefined}
          aria-pressed={said}
        >
          <span className="aula-amen-heart" key={burst}>♥</span>
          {said ? "Amén" : "Decir amén"}
        </button>
        {verses.length > 1 ? (
          <button type="button" onClick={() => setIndex((value) => (value + 1) % verses.length)} className="aula-chip">
            Otro versículo ↻
          </button>
        ) : null}
        <button type="button" onClick={share} className="aula-chip">{copied ? "¡Copiado!" : "Compartir"}</button>
      </div>
    </div>
  );
}

export function GradesCard({ grades, summary, level }: { grades: Grade[]; summary: Summary; level: StudyLevel | null }) {
  const average = summary.average;
  const passing = average !== null && average >= summary.pass_score;
  return (
    <div className="aula-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="aula-kicker text-ink/50">Mis notas</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{level?.name ?? "Sin nivel"}</h2>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Promedio</p>
          <p className={`text-4xl font-semibold tabular-nums tracking-[-0.04em] ${average === null ? "text-ink/30" : passing ? "text-emerald-700" : "text-red-700"}`}>
            {average === null ? "—" : average.toFixed(1)}
          </p>
        </div>
      </div>
      {grades.length ? (
        <>
          <ul className="mt-5 grid gap-3">
            {grades.map((grade, index) => (
              <li key={grade.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {grade.title}
                    {grade.week ? <span className="ml-1.5 text-xs text-muted">Semana {grade.week}</span> : null}
                  </span>
                  <span className={`font-semibold tabular-nums ${grade.score === null ? "text-muted" : grade.score >= summary.pass_score ? "" : "text-red-700"}`}>
                    {grade.score === null ? "Pendiente" : grade.score.toFixed(grade.score % 1 ? 1 : 0)}
                  </span>
                </div>
                <div className="aula-score mt-1.5">
                  <i
                    data-low={grade.score !== null && grade.score < summary.pass_score ? true : undefined}
                    style={{ width: `${grade.score === null ? 0 : (grade.score / summary.max_score) * 100}%`, "--n": index } as CSSProperties}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-2xl bg-paper px-4 py-3 text-[13px] leading-5 text-muted">
            {summary.graded === 0
              ? `Tus notas aparecerán aquí apenas tu maestro las registre. Apruebas con ${summary.pass_score}.`
              : passing
                ? `¡Vas muy bien! Llevas ${summary.graded} de ${summary.total} notas y apruebas con ${summary.pass_score}.`
                : `Llevas ${summary.graded} de ${summary.total} notas. Apruebas con ${summary.pass_score}: ¡tú puedes, sigue adelante!`}
          </p>
        </>
      ) : (
        <Empty>Tus notas aparecerán aquí apenas tu maestro las registre.</Empty>
      )}
    </div>
  );
}

export function RouteCard({ route }: { route: RouteStep[] }) {
  const pages = useSitePages();
  return (
    <div className="aula-card">
      <p className="aula-kicker text-ink/50">Mi ruta</p>
      <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{pages.name("route")}</h2>
      <ol className="aula-route mt-5">
        {route.map((step, index) => (
          <li key={step.id} data-state={step.state}>
            <span className="aula-route-node">{step.state === "done" ? "✓" : index + 1}</span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold tracking-[-0.01em]">
                {step.name}
                {step.state === "current" ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">Aquí estás</span> : null}
                {step.state === "done" && step.average !== null ? <span className="text-xs font-medium text-muted">Promedio {step.average.toFixed(1)}</span> : null}
              </p>
              {step.summary ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{step.summary}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SectionTitle({ kicker, title, count }: { kicker: string; title: string; count?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="aula-kicker text-ink/50">{kicker}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{title}</h2>
      </div>
      {count ? <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-muted shadow-sm">{count}</span> : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 rounded-[1.4rem] border border-dashed border-ink/15 px-5 py-6 text-center text-sm leading-6 text-muted">{children}</p>;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Countdown, Meter, OptionButton, primary, type OptionState } from "@/Components/games/ui";
import { DIFFICULTY_LABEL, type RebetGrade, type RebetQuestion } from "@/lib/games";

const LETTERS = ["A", "B", "C", "D"];

/**
 * One timed REBET question. The clock starts when it appears (or where the server says it
 * already is), a tap or the keys 1–4 / A–D answer, and the grade always comes from the server.
 */
export function RebetQuestionCard({
  question,
  number,
  total,
  score,
  streak,
  player,
  grade,
  onNext,
  nextLabel,
}: {
  question: RebetQuestion;
  number: number;
  total: number;
  score: number;
  streak: number;
  player?: string;
  grade: (choice: number, seconds: number) => Promise<RebetGrade & { error?: string }>;
  onNext: () => void;
  nextLabel: string;
}) {
  const startedAt = useRef(performance.now() - (question.elapsed ?? 0) * 1000);
  const [left, setLeft] = useState(question.time_limit - (question.elapsed ?? 0));
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<RebetGrade | null>(null);
  const [error, setError] = useState("");
  const locked = useRef(false);

  const answer = useCallback(
    async (choice: number) => {
      if (locked.current) return;
      locked.current = true;
      setPicked(choice);
      const seconds = (performance.now() - startedAt.current) / 1000;
      const reply = await grade(choice, seconds);
      if (reply.error) {
        setError(reply.error);
        locked.current = false;
        setPicked(null);
        return;
      }
      setResult(reply);
    },
    [grade],
  );

  useEffect(() => {
    if (result) return;
    const timer = window.setInterval(() => {
      const remaining = question.time_limit - (performance.now() - startedAt.current) / 1000;
      setLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        void answer(-1);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [question.time_limit, result, answer]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toUpperCase();
      if (result && (key === "ENTER" || key === " ")) {
        event.preventDefault();
        onNext();
        return;
      }
      const index = "1234".includes(key) ? Number(key) - 1 : LETTERS.indexOf(key);
      if (!result && index >= 0 && index < question.options.length) void answer(index);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question.options.length, result, answer, onNext]);

  const stateOf = (index: number): OptionState => {
    if (!result) return picked === index ? "picked" : picked !== null ? "faded" : "idle";
    if (index === result.right) return "right";
    if (index === picked) return "wrong";
    return "faded";
  };

  return (
    <div className="panel p-6 md:p-9">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            Pregunta {number} de {total}
            {player ? <span className="text-accent"> · {player}</span> : null}
          </p>
          <p className="mt-1 truncate text-sm text-muted">
            {question.category} · {DIFFICULTY_LABEL[question.difficulty]}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Puntos</p>
            <p className="text-xl font-semibold tabular-nums text-ink">{score.toLocaleString("es-PE")}</p>
          </div>
          <Countdown left={result ? Math.max(left, 0) : left} total={question.time_limit} />
        </div>
      </div>
      <Meter value={number - (result ? 0 : 1)} total={total} className="mt-5" />

      <h2 className="editorial mt-8 text-[1.9rem] leading-[1.12] text-ink md:text-[2.4rem]">{question.question}</h2>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {question.options.map((option, index) => (
          <OptionButton key={index} label={LETTERS[index]} text={option} state={stateOf(index)} disabled={picked !== null} onClick={() => void answer(index)} />
        ))}
      </div>

      {error ? <div className="mt-5"><Alert>{error}</Alert></div> : null}

      {result ? (
        <div className={`mt-7 rounded-[1.4rem] p-5 md:p-6 ${result.correct ? "bg-emerald-50" : "bg-accent-soft"}`} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-lg font-semibold ${result.correct ? "text-emerald-900" : "text-ink"}`}>
              {result.correct ? "¡Correcto!" : result.late || picked === -1 ? "Se acabó el tiempo" : "No era esa"}
            </p>
            {result.correct ? (
              <p className="text-lg font-semibold tabular-nums text-emerald-900">
                +{result.points.toLocaleString("es-PE")}
                {streak > 1 ? <span className="ml-2 text-sm font-medium">· racha de {streak}</span> : null}
              </p>
            ) : null}
          </div>
          {result.explanation ? <p className="mt-2 text-[15px] leading-7 text-ink/80">{result.explanation}</p> : null}
          {result.reference ? <p className="mt-2 text-sm font-semibold text-accent">{result.reference}</p> : null}
          <button type="button" onClick={onNext} className={`${primary} mt-5`} autoFocus>
            {nextLabel} →
          </button>
        </div>
      ) : (
        <p className="mt-6 hidden text-xs text-muted md:block">Atajo: teclas 1–4 o A–D.</p>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ArrowRight, Countdown, Meter, OptionButton, primary, type OptionState } from "@/Components/games/ui";
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

  const timedOut = result && !result.correct && (result.late || picked === -1);

  return (
    <div className="game-surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line bg-sage/35 px-5 py-4 md:px-7">
        <div className="min-w-0">
          <p className="game-label">
            Pregunta {number} de {total}
            {player ? <span className="text-accent"> · {player}</span> : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {question.category ? <span className="max-w-[12rem] truncate rounded-full bg-card px-2.5 py-1 text-xs font-medium text-ink">{question.category}</span> : null}
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{DIFFICULTY_LABEL[question.difficulty]}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="game-label">Puntos</p>
            <p className="text-xl font-bold tabular-nums text-ink">{score.toLocaleString("es-PE")}</p>
            {streak > 1 ? <p className="text-xs font-semibold text-accent">Racha ×{streak}</p> : null}
          </div>
          <Countdown left={result ? Math.max(left, 0) : left} total={question.time_limit} />
        </div>
      </div>
      <Meter value={number - (result ? 0 : 1)} total={total} />

      <div className="p-6 md:p-9">
        <h2 className="editorial text-[1.7rem] leading-[1.15] md:text-[2.3rem]">{question.question}</h2>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {question.options.map((option, index) => (
            <OptionButton key={index} label={LETTERS[index]} text={option} state={stateOf(index)} disabled={picked !== null} onClick={() => void answer(index)} />
          ))}
        </div>

        {error ? <div className="mt-5"><Alert>{error}</Alert></div> : null}

        {result ? (
          <div className={`game-pop mt-7 rounded-[1.4rem] border p-5 md:p-6 ${result.correct ? "border-emerald-200 bg-emerald-50" : "border-accent/20 bg-accent-soft"}`} aria-live="polite">
            <div className="flex flex-wrap items-center gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-bold text-white ${result.correct ? "bg-emerald-600" : "bg-accent"}`}>{result.correct ? "✓" : timedOut ? "⏱" : "✕"}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-lg font-semibold ${result.correct ? "text-emerald-900" : "text-ink"}`}>{result.correct ? "¡Correcto!" : timedOut ? "Se acabó el tiempo" : "No era esa"}</p>
                {!result.correct ? <p className="text-sm text-muted">La respuesta era «{question.options[result.right]}».</p> : null}
              </div>
              {result.correct ? <p className="text-2xl font-bold tabular-nums text-emerald-800">+{result.points.toLocaleString("es-PE")}</p> : null}
            </div>
            {result.explanation ? <p className="mt-4 text-[15px] leading-7 text-ink/80">{result.explanation}</p> : null}
            {result.reference ? <p className="mt-2 text-sm font-semibold text-accent">{result.reference}</p> : null}
            <button type="button" onClick={onNext} className={`${primary} mt-5 w-full sm:w-auto`} autoFocus>
              {nextLabel} <ArrowRight />
            </button>
          </div>
        ) : (
          <p className="mt-6 hidden text-xs text-muted md:block">Atajo: teclas 1–4 o A–D.</p>
        )}
      </div>
    </div>
  );
}

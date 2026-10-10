import { Link } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { Alert, ArrowRight, GamePage, Meter, OptionButton, ghost, primary, useScreenTop, type OptionState } from "@/Components/games/ui";
import { lingoProgress, postJson } from "@/lib/games";

type Exercise = { id: string; kind: "choice" | "truefalse"; prompt: string; passage_reference: string | null; passage_text: string | null; options: string[] };
type Lesson = { id: string; title: string; unit: string; xp: number; number: number; total: number; previous: string | null; exercises: Exercise[] };
type Grade = { correct: boolean; right: number; reference: string | null };

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function LingoLesson({ path, lesson, next }: { path: { slug: string; title: string }; lesson: Lesson; next: { id: string; title: string } | null }) {
  const [phase, setPhase] = useState<"preview" | "question" | "finish">("preview");
  useScreenTop(phase);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [right, setRight] = useState(0);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<{ score: number; stars: number; passed: boolean } | null>(null);
  const exercise = lesson.exercises[index];
  const sample = lesson.exercises.find((item) => item.passage_text);
  const back = { href: `/juegos/lingobible/${path.slug}`, label: path.title };

  function begin() {
    setIndex(0);
    setRight(0);
    setPicked(null);
    setGrade(null);
    setOutcome(null);
    setPhase("question");
  }

  async function choose(choice: number) {
    if (picked !== null) return;
    setPicked(choice);
    setError("");
    const reply = await postJson<Grade>("/juegos/lingobible/responder", { exercise: exercise.id, choice });
    if (reply.error) {
      setPicked(null);
      return setError(reply.error);
    }
    setGrade(reply);
    if (reply.correct) setRight((count) => count + 1);
  }

  function advance() {
    if (index + 1 < lesson.exercises.length) {
      setIndex(index + 1);
      setPicked(null);
      setGrade(null);
      return;
    }
    const score = Math.round((right / lesson.exercises.length) * 100);
    setOutcome({ score, ...lingoProgress.save(lesson.id, score, lesson.xp) });
    setPhase("finish");
  }

  const stateOf = (position: number): OptionState => {
    if (!grade) return picked === position ? "picked" : picked !== null ? "faded" : "idle";
    if (position === grade.right) return "right";
    if (position === picked) return "wrong";
    return "faded";
  };

  return (
    <GamePage
      kicker={`LINGOBIBLE · ${lesson.unit}`}
      title={lesson.title}
      back={back}
      compact={phase !== "preview"}
      aside={
        phase === "question" ? (
          <span className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold tabular-nums text-ink">
            {right} {right === 1 ? "acierto" : "aciertos"}
          </span>
        ) : undefined
      }
    >
      {phase === "preview" ? (
        <Rise className="game-surface mx-auto mt-12 max-w-2xl p-7 md:p-10">
          <p className="game-label">
            Lección {lesson.number} de {lesson.total}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-sage px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Preguntas</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{lesson.exercises.length}</p>
            </div>
            <div className="rounded-2xl bg-accent-soft px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Recompensa</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{lesson.xp} XP</p>
            </div>
          </div>
          {sample ? <Passage reference={sample.passage_reference} text={sample.passage_text} /> : null}
          <p className="mt-6 text-[15px] leading-7 text-muted">Aprueba con 70% o más para abrir la siguiente lección. Tu avance se guarda en este celular.</p>
          <button type="button" className={`${primary} mt-7 w-full sm:w-auto`} onClick={begin} autoFocus>
            Empezar lección
          </button>
        </Rise>
      ) : null}

      {phase === "question" && exercise ? (
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="flex items-center gap-4">
            <Meter value={index + (grade ? 1 : 0)} total={lesson.exercises.length} className="flex-1" />
            <span className="text-sm font-semibold tabular-nums text-muted">
              {index + 1}/{lesson.exercises.length}
            </span>
          </div>
          <div className="game-surface game-pop mt-6 p-5 sm:p-6 md:p-9" key={exercise.id}>
            {exercise.passage_text ? <Passage reference={exercise.passage_reference} text={exercise.passage_text} /> : null}
            <p className="game-label mt-6">{exercise.kind === "truefalse" ? "Verdadero o falso" : "Elige la respuesta"}</p>
            <h2 className="editorial mt-3 text-[1.75rem] leading-[1.15] text-ink md:text-[2.1rem]">{exercise.prompt}</h2>
            <div className={`mt-7 grid gap-3 ${exercise.kind === "truefalse" ? "sm:grid-cols-2" : ""}`}>
              {exercise.options.map((option, position) => (
                <OptionButton
                  key={position}
                  label={exercise.kind === "truefalse" ? (position === 0 ? "V" : "F") : LETTERS[position]}
                  text={option}
                  state={stateOf(position)}
                  disabled={picked !== null}
                  onClick={() => void choose(position)}
                />
              ))}
            </div>
            {error ? <div className="mt-5"><Alert>{error}</Alert></div> : null}
            {grade ? (
              <div className={`mt-7 rounded-[1.4rem] p-5 ${grade.correct ? "bg-emerald-50" : "bg-accent-soft"}`} aria-live="polite">
                <p className={`text-lg font-semibold ${grade.correct ? "text-emerald-900" : "text-ink"}`}>{grade.correct ? "Respuesta correcta" : "Revisa el texto otra vez"}</p>
                {grade.reference ? <p className="mt-1 text-sm font-semibold text-accent">{grade.reference}</p> : null}
                <button type="button" className={`${primary} mt-4 w-full sm:w-auto`} onClick={advance} autoFocus>
                  {index + 1 < lesson.exercises.length ? "Continuar" : "Ver resultado"} <ArrowRight />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "finish" && outcome ? (
        <div className="mx-auto mt-8 grid max-w-2xl gap-5">
          <Rise className="game-dark p-7 text-center md:p-10">
            <p className="game-label">{outcome.passed ? "Lección aprobada" : "Casi lo logras"}</p>
            <p className="mt-5 text-4xl tracking-[0.2em] text-accent" aria-label={`${outcome.stars} estrellas`}>
              {"★".repeat(outcome.stars)}
              <span className="text-white/20">{"★".repeat(3 - outcome.stars)}</span>
            </p>
            <p className="editorial mt-4 text-7xl tabular-nums text-white">{outcome.score}%</p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-white/70">
              {right} de {lesson.exercises.length} correctas.{" "}
              {outcome.passed ? `Ganaste ${lesson.xp} XP.` : "Necesitas 70% para aprobar. Vuelve a leer los pasajes e inténtalo otra vez."}
            </p>
          </Rise>
          <div className="flex flex-wrap gap-3">
            {outcome.passed && next ? (
              <Link href={`/juegos/lingobible/${path.slug}/${next.id}`} className={`${primary} w-full sm:w-auto`}>
                <span className="truncate">Siguiente: {next.title}</span>
                <ArrowRight />
              </Link>
            ) : null}
            <button type="button" className={outcome.passed && next ? ghost : `${primary} w-full sm:w-auto`} onClick={begin}>
              Repetir lección
            </button>
            <Link href={back.href} className={ghost}>
              Volver a la ruta
            </Link>
          </div>
        </div>
      ) : null}
    </GamePage>
  );
}

function Passage({ reference, text }: { reference: string | null; text: string | null }) {
  if (!text) return null;
  return (
    <blockquote className="mt-6 rounded-[1.3rem] border-l-4 border-accent bg-sage/60 px-5 py-4">
      <p className="editorial text-xl italic leading-relaxed text-ink">«{text}»</p>
      {reference ? <cite className="mt-2 block text-sm font-semibold not-italic text-accent">{reference}</cite> : null}
    </blockquote>
  );
}

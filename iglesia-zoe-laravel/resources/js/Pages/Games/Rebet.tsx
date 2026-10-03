import { router } from "@inertiajs/react";
import { useCallback, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { RebetQuestionCard } from "@/Components/games/rebet-question";
import { RebetSetup, type RebetSettings } from "@/Components/games/rebet-setup";
import { Alert, Field, GameEmblem, GamePage, Scoreboard, StatTile, field, ghost, primary } from "@/Components/games/ui";
import { getJson, playerName, postJson, query, roomToken, shuffle, type RebetGrade, type RebetQuestion, type Theme } from "@/lib/games";

type Mode = "solo" | "juntos" | "sala";
type Tally = { name: string; score: number; correct: number; wrong: number; streak: number; best: number };
type Stage = { kind: "menu" } | { kind: "setup"; mode: Mode } | { kind: "handoff" } | { kind: "play" } | { kind: "result" };

const MODES: { key: Mode; title: string; text: string }[] = [
  { key: "solo", title: "Solo", text: "Tú contra el reloj. Ideal para practicar." },
  { key: "juntos", title: "Por turnos", text: "De 2 a 8 personas en un mismo celular, pasándolo de mano en mano." },
  { key: "sala", title: "Sala en vivo", text: "Cada uno juega desde su celular y el marcador se ve en tiempo real." },
];

const fresh = (name: string): Tally => ({ name, score: 0, correct: 0, wrong: 0, streak: 0, best: 0 });

export default function Rebet({ themes, counts }: { themes: Theme[]; counts: number[] }) {
  const [stage, setStage] = useState<Stage>({ kind: "menu" });
  const [mode, setMode] = useState<Mode>("solo");
  const [settings, setSettings] = useState<RebetSettings>({ categories: [], difficulty: "mixed", count: 10 });
  const [names, setNames] = useState<string[]>(["", ""]);
  const [host, setHost] = useState(playerName.get());
  const [questions, setQuestions] = useState<RebetQuestion[]>([]);
  const [order, setOrder] = useState<RebetQuestion[]>([]);
  const [players, setPlayers] = useState<Tally[]>([]);
  const [turn, setTurn] = useState(0);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    if (mode === "sala") return openRoom();
    const roster = mode === "juntos" ? names.map((name) => name.trim()).filter(Boolean) : ["Tú"];
    if (mode === "juntos" && roster.length < 2) return setError("Escribe el nombre de al menos 2 jugadores.");
    setBusy(true);
    const reply = await getJson<{ questions: RebetQuestion[] }>(`/juegos/rebet/preguntas?${query({ temas: settings.categories, dificultad: settings.difficulty, cantidad: settings.count })}`);
    setBusy(false);
    if (reply.error || !reply.questions?.length) return setError(reply.error || "No hay preguntas para esta combinación. Prueba con otros temas.");
    setQuestions(reply.questions);
    setOrder(reply.questions);
    setPlayers(roster.map(fresh));
    setTurn(0);
    setIndex(0);
    setStage(mode === "juntos" ? { kind: "handoff" } : { kind: "play" });
  }

  async function openRoom() {
    if (host.trim().length < 2) return setError("Escribe tu nombre para abrir la sala.");
    setBusy(true);
    const reply = await postJson<{ code: string; token: string }>("/juegos/salas", { game: "rebet", name: host, settings });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(host);
    roomToken.set(reply.code, reply.token);
    router.visit(`/juegos/sala/${reply.code}`);
  }

  const current = players[turn];
  const question = order[index];

  const grade = useCallback(
    async (choice: number, seconds: number) => {
      const reply = await postJson<RebetGrade>("/juegos/rebet/responder", { question: question.id, choice, seconds, streak: current.streak });
      if (!reply.error) {
        setPlayers((list) =>
          list.map((player, position) => {
            if (position !== turn) return player;
            const streak = reply.correct ? player.streak + 1 : 0;
            return {
              ...player,
              score: player.score + reply.points,
              correct: player.correct + (reply.correct ? 1 : 0),
              wrong: player.wrong + (reply.correct ? 0 : 1),
              streak,
              best: Math.max(player.best, streak),
            };
          }),
        );
      }
      return reply;
    },
    [question, current, turn],
  );

  function next() {
    if (index + 1 < order.length) return setIndex(index + 1);
    if (turn + 1 < players.length) {
      setTurn(turn + 1);
      setIndex(0);
      setOrder(shuffle(questions));
      return setStage({ kind: "handoff" });
    }
    setStage({ kind: "result" });
  }

  function replay() {
    setStage({ kind: "setup", mode });
    void start();
  }

  const back = stage.kind === "menu" ? { href: "/juegos", label: "Juegos" } : undefined;

  return (
    <GamePage
      kicker="Juegos · REBET"
      title="REBET"
      text={stage.kind === "menu" ? "Trivia bíblica contra el reloj. Acierta rápido y seguido para multiplicar tus puntos." : undefined}
      back={back}
      aside={stage.kind === "menu" ? <GameEmblem game="rebet" className="hidden h-24 w-24 lg:block" /> : undefined}
    >
      {stage.kind === "menu" ? (
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {MODES.map((item, position) => (
            <Rise key={item.key} delay={position * 80}>
              <button
                type="button"
                onClick={() => {
                  setMode(item.key);
                  setError("");
                  setStage({ kind: "setup", mode: item.key });
                }}
                className="panel flex h-full w-full flex-col p-7 text-left transition duration-300 hover:-translate-y-1"
              >
                <span className="kicker">Modo</span>
                <span className="editorial mt-3 text-3xl text-ink">{item.title}</span>
                <span className="mt-3 text-[15px] leading-7 text-muted">{item.text}</span>
                <span className="mt-auto pt-7 text-sm font-semibold text-accent">Elegir →</span>
              </button>
            </Rise>
          ))}
          <Rise className="md:col-span-3">
            <div className="rounded-[1.6rem] border border-line bg-card p-6 text-[15px] leading-7 text-muted md:p-7">
              <p className="font-semibold text-ink">¿Cómo se gana?</p>
              <p className="mt-1">
                Cada acierto vale 1.000 puntos, más hasta 500 por responder rápido y 50 extra por cada acierto seguido. Las preguntas difíciles valen 1,5 veces y las de nivel experto el doble.
              </p>
            </div>
          </Rise>
        </div>
      ) : null}

      {stage.kind === "setup" ? (
        <Rise className="panel mt-12 p-6 md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="editorial text-3xl text-ink">{MODES.find((item) => item.key === mode)?.title}</h2>
            <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={() => setStage({ kind: "menu" })}>
              ← Cambiar modo
            </button>
          </div>
          <div className="mt-8 grid gap-8">
            {mode === "juntos" ? (
              <Field label="Jugadores" hint="Cada uno responde las mismas preguntas en su turno.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {names.map((name, position) => (
                    <div key={position} className="flex gap-2">
                      <input
                        value={name}
                        maxLength={24}
                        onChange={(event) => setNames(names.map((item, at) => (at === position ? event.target.value : item)))}
                        placeholder={`Jugador ${position + 1}`}
                        className={field}
                      />
                      {names.length > 2 ? (
                        <button type="button" aria-label="Quitar jugador" onClick={() => setNames(names.filter((_, at) => at !== position))} className="px-2 text-muted hover:text-ink">
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {names.length < 8 ? (
                  <button type="button" onClick={() => setNames([...names, ""])} className={`${ghost} mt-3`}>
                    + Agregar jugador
                  </button>
                ) : null}
              </Field>
            ) : null}
            {mode === "sala" ? (
              <Field label="Tu nombre" hint="Abres la sala y compartes el código; los demás entran desde su celular.">
                <input value={host} maxLength={24} onChange={(event) => setHost(event.target.value)} placeholder="Ej. Pastor Luis" className={`${field} max-w-sm`} />
              </Field>
            ) : null}
            <RebetSetup themes={themes} counts={counts} value={settings} onChange={setSettings} />
            {error ? <Alert>{error}</Alert> : null}
            <div>
              <button type="button" onClick={() => void start()} disabled={busy} className={primary}>
                {busy ? "Preparando…" : mode === "sala" ? "Abrir sala" : "Empezar"}
              </button>
            </div>
          </div>
        </Rise>
      ) : null}

      {stage.kind === "handoff" && current ? (
        <Rise className="panel mx-auto mt-12 max-w-xl p-8 text-center md:p-12">
          <p className="kicker">Turno {turn + 1} de {players.length}</p>
          <p className="editorial mt-4 text-4xl text-ink">Pasa el celular a {current.name}</p>
          <p className="mt-3 text-[15px] leading-7 text-muted">Que nadie más mire la pantalla. Son {order.length} preguntas.</p>
          <button type="button" className={`${primary} mt-8`} onClick={() => setStage({ kind: "play" })} autoFocus>
            Soy {current.name}, empezar
          </button>
        </Rise>
      ) : null}

      {stage.kind === "play" && question && current ? (
        <div className="mx-auto mt-12 max-w-3xl">
          <RebetQuestionCard
            key={`${turn}-${question.id}`}
            question={question}
            number={index + 1}
            total={order.length}
            score={current.score}
            streak={current.streak}
            player={players.length > 1 ? current.name : undefined}
            grade={grade}
            onNext={next}
            nextLabel={index + 1 < order.length ? "Siguiente" : turn + 1 < players.length ? "Siguiente jugador" : "Ver resultado"}
          />
        </div>
      ) : null}

      {stage.kind === "result" ? <RebetResult players={players} total={order.length} onReplay={replay} onSetup={() => setStage({ kind: "setup", mode })} /> : null}
    </GamePage>
  );
}

function RebetResult({ players, total, onReplay, onSetup }: { players: Tally[]; total: number; onReplay: () => void; onSetup: () => void }) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const solo = players.length === 1 ? players[0] : null;

  return (
    <Rise className="panel mx-auto mt-12 max-w-3xl p-7 md:p-10">
      <p className="kicker">Resultado</p>
      {solo ? (
        <>
          <p className="editorial mt-3 text-6xl tabular-nums text-ink">{solo.score.toLocaleString("es-PE")}</p>
          <p className="mt-2 text-muted">puntos</p>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Correctas" value={solo.correct} />
            <StatTile label="Incorrectas" value={solo.wrong} />
            <StatTile label="Precisión" value={`${total ? Math.round((solo.correct / total) * 100) : 0}%`} />
            <StatTile label="Mejor racha" value={solo.best} />
          </div>
        </>
      ) : (
        <>
          <p className="editorial mt-3 text-4xl text-ink">¡Ganó {ranked[0]?.name}!</p>
          <div className="mt-8">
            <Scoreboard rows={ranked.map((player) => ({ id: player.name, name: player.name, score: player.score, correct: player.correct }))} />
          </div>
        </>
      )}
      <div className="mt-9 flex flex-wrap gap-3">
        <button type="button" className={primary} onClick={onReplay}>Jugar otra vez</button>
        <button type="button" className={ghost} onClick={onSetup}>Cambiar temas</button>
      </div>
    </Rise>
  );
}

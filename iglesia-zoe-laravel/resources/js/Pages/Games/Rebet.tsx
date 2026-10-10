import { router } from "@inertiajs/react";
import { useCallback, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { JoinByCode } from "@/Components/games/join-code";
import { RebetQuestionCard } from "@/Components/games/rebet-question";
import { Podium } from "@/Components/games/rebet-room";
import { RebetSetup, RosterField, type RebetSettings } from "@/Components/games/rebet-setup";
import { Alert, Avatar, Field, GameEmblem, GamePage, GroupIcon, ModeCard, PhoneIcon, Scoreboard, StatTile, UserIcon, field, ghost, primary, useScreenTop } from "@/Components/games/ui";
import { getJson, playerName, postJson, query, roomToken, roomUrl, shuffle, type RebetGrade, type RebetQuestion, type Theme } from "@/lib/games";

type Mode = "solo" | "juntos" | "sala";
type Tally = { name: string; score: number; correct: number; wrong: number; streak: number; best: number };
type Stage = "menu" | "setup" | "handoff" | "play" | "result";

const MODES: { key: Mode; title: string; text: string; tags: string[]; icon: React.ReactNode; intro: string }[] = [
  { key: "solo", title: "Solo", text: "Tú contra el reloj. Ideal para practicar y superar tu mejor puntaje.", tags: ["1 jugador", "A tu ritmo"], icon: <UserIcon />, intro: "Responde rápido y seguido para multiplicar tus puntos." },
  { key: "juntos", title: "Por turnos", text: "De 2 a 8 personas en un mismo celular, pasándolo de mano en mano.", tags: ["2 a 8 jugadores", "Un celular"], icon: <PhoneIcon />, intro: "Cada uno responde las mismas preguntas en su turno. Gana quien sume más puntos." },
  { key: "sala", title: "Sala en vivo", text: "Cada uno juega desde su celular y el marcador se ve en tiempo real.", tags: ["Hasta 30 jugadores", "Código para compartir"], icon: <GroupIcon />, intro: "Abres la sala, compartes el código y todos responden a la vez desde su celular." },
];

const SCORING: [string, string][] = [
  ["1.000", "puntos por acierto"],
  ["+500", "si respondes rápido"],
  ["+50", "por cada acierto seguido"],
  ["×1,5 · ×2", "en difícil y experto"],
];

const fresh = (name: string): Tally => ({ name, score: 0, correct: 0, wrong: 0, streak: 0, best: 0 });

export default function Rebet({ themes, counts }: { themes: Theme[]; counts: number[] }) {
  const [stage, setStage] = useState<Stage>("menu");
  useScreenTop(stage);
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
  const info = MODES.find((item) => item.key === mode) ?? MODES[0];

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
    setStage(mode === "juntos" ? "handoff" : "play");
  }

  async function openRoom() {
    if (host.trim().length < 2) return setError("Escribe tu nombre para abrir la sala.");
    setBusy(true);
    const reply = await postJson<{ code: string; token: string }>("/juegos/salas", { game: "rebet", name: host, settings });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(host);
    roomToken.set(reply.code, reply.token);
    router.visit(roomUrl("rebet", reply.code));
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
      return setStage("handoff");
    }
    setStage("result");
  }

  const menu = stage === "menu";

  return (
    <GamePage
      compact={!menu}
      kicker={menu ? "Juegos · REBET" : `REBET · ${info.title}`}
      title="REBET"
      text={menu ? "Trivia bíblica contra el reloj. Acierta rápido y seguido para multiplicar tus puntos." : undefined}
      back={menu ? { href: "/juegos", label: "Juegos" } : undefined}
      aside={
        menu ? (
          <GameEmblem game="rebet" className="hidden h-24 w-24 lg:block" />
        ) : stage === "play" ? (
          <button type="button" className={ghost} onClick={() => window.confirm("¿Salir de esta partida?") && setStage("menu")}>
            Salir
          </button>
        ) : (
          <button type="button" className={ghost} onClick={() => setStage("menu")}>
            Cambiar modo
          </button>
        )
      }
    >
      {menu ? (
        <>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {MODES.map((item, position) => (
              <ModeCard
                key={item.key}
                icon={item.icon}
                title={item.title}
                text={item.text}
                tags={item.tags}
                delay={position * 80}
                onClick={() => {
                  setMode(item.key);
                  setError("");
                  setStage("setup");
                }}
              />
            ))}
          </div>
          <JoinByCode game="rebet" />
          <Rise className="mt-16">
            <p className="kicker">¿Cómo se gana?</p>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {SCORING.map(([value, label]) => (
                <div key={label} className="rounded-[1.4rem] border border-line bg-card p-5">
                  <p className="editorial text-3xl text-accent">{value}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{label}</p>
                </div>
              ))}
            </div>
          </Rise>
        </>
      ) : null}

      {stage === "setup" ? (
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <Rise className="game-dark p-7 md:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white">{info.icon}</span>
            <p className="game-label mt-6">Modo</p>
            <h2 className="editorial mt-2 text-4xl text-white">{info.title}</h2>
            <p className="mt-3 text-[15px] leading-7 text-white/70">{info.intro}</p>
            <ul className="mt-6 grid gap-2 text-sm text-white/80">
              {SCORING.map(([value, label]) => (
                <li key={label} className="flex items-baseline gap-3">
                  <span className="w-20 shrink-0 font-semibold text-white">{value}</span>
                  {label}
                </li>
              ))}
            </ul>
          </Rise>
          <Rise delay={80} className="game-surface p-6 md:p-8">
            <div className="grid gap-8">
              {mode === "juntos" ? <RosterField names={names} onChange={setNames} min={2} max={8} /> : null}
              {mode === "sala" ? (
                <Field label="Tu nombre" hint="Abres la sala y compartes el código; los demás entran desde su celular.">
                  <div className="flex items-center gap-3">
                    <Avatar name={host.trim() || "?"} />
                    <input value={host} maxLength={24} onChange={(event) => setHost(event.target.value)} placeholder="Ej. Pastor Luis" autoComplete="nickname" className={`${field} max-w-sm`} />
                  </div>
                </Field>
              ) : null}
              <RebetSetup themes={themes} counts={counts} value={settings} onChange={setSettings} />
            </div>
            {error ? <div className="mt-6"><Alert>{error}</Alert></div> : null}
            <div className="mt-8 border-t border-line pt-7">
              <button type="button" onClick={() => void start()} disabled={busy} className={`${primary} w-full sm:w-auto`}>
                {busy ? "Preparando…" : mode === "sala" ? "Abrir sala" : "Empezar"}
              </button>
            </div>
          </Rise>
        </div>
      ) : null}

      {stage === "handoff" && current ? (
        <Rise className="game-dark mx-auto mt-10 max-w-xl p-8 text-center md:p-12">
          <p className="game-label">
            Turno {turn + 1} de {players.length}
          </p>
          <Avatar name={current.name} size="xl" className="mx-auto mt-7" />
          <p className="editorial mt-6 text-4xl leading-tight text-white">Pasa el celular a {current.name}</p>
          <p className="mt-3 text-[15px] leading-7 text-white/70">Que nadie más mire la pantalla. Son {order.length} preguntas.</p>
          <button type="button" className={`${primary} mt-8 w-full sm:w-auto`} onClick={() => setStage("play")} autoFocus>
            Soy {current.name}, empezar
          </button>
        </Rise>
      ) : null}

      {stage === "play" && question && current ? (
        <div className="mx-auto mt-8 max-w-3xl">
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

      {stage === "result" ? <RebetResult players={players} total={order.length} onReplay={() => void start()} onSetup={() => setStage("setup")} onExit={() => setStage("menu")} busy={busy} /> : null}
    </GamePage>
  );
}

function RebetResult({ players, total, onReplay, onSetup, onExit, busy }: { players: Tally[]; total: number; onReplay: () => void; onSetup: () => void; onExit: () => void; busy: boolean }) {
  const ranked = players.map((player, position) => ({ ...player, id: String(position) })).sort((a, b) => b.score - a.score);
  const solo = players.length === 1 ? players[0] : null;

  return (
    <div className="mx-auto mt-8 grid max-w-3xl gap-5">
      <Rise className="game-dark p-7 text-center md:p-10">
        <p className="game-label">Resultado</p>
        {solo ? (
          <>
            <p className="editorial mt-4 text-7xl tabular-nums text-white md:text-8xl">{solo.score.toLocaleString("es-PE")}</p>
            <p className="mt-2 text-white/70">puntos</p>
          </>
        ) : (
          <>
            <h2 className="editorial mt-3 text-[2.4rem] leading-tight text-white md:text-6xl">¡Ganó {ranked[0]?.name}!</h2>
            <div className="mx-auto mt-8 max-w-xl">
              <Podium rows={ranked} />
            </div>
          </>
        )}
      </Rise>
      {solo ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Correctas" value={solo.correct} />
          <StatTile label="Incorrectas" value={solo.wrong} />
          <StatTile label="Precisión" value={`${total ? Math.round((solo.correct / total) * 100) : 0}%`} />
          <StatTile label="Mejor racha" value={solo.best} />
        </div>
      ) : (
        <Scoreboard rows={ranked} />
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={`${primary} flex-1 sm:flex-none`} onClick={onReplay} disabled={busy}>
          {busy ? "Preparando…" : "Jugar otra vez"}
        </button>
        <button type="button" className={ghost} onClick={onSetup}>
          Cambiar ajustes
        </button>
        <button type="button" className={ghost} onClick={onExit}>
          Salir
        </button>
      </div>
    </div>
  );
}

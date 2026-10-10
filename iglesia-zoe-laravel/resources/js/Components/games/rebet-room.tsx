import { useCallback, useEffect, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { RebetQuestionCard } from "@/Components/games/rebet-question";
import { RebetSetup, type RebetSettings } from "@/Components/games/rebet-setup";
import { RoomLobby } from "@/Components/games/room-lobby";
import { Avatar, EndActions, Scoreboard, Waiting } from "@/Components/games/ui";
import { DIFFICULTY_LABEL, type RebetGrade, type RebetQuestion, type RebetRoomState, type Reply, type Theme } from "@/lib/games";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<Reply<RebetRoomState>>;

export function RebetRoomView({ room, act, busy, themes, onExit }: { room: RebetRoomState; act: Act; busy: boolean; themes: Theme[]; onExit: () => void }) {
  if (room.status === "lobby") {
    return <RebetLobby room={room} act={act} busy={busy} themes={themes} onExit={onExit} />;
  }
  if (room.status === "finished") {
    return <RebetFinal room={room} act={act} busy={busy} onExit={onExit} />;
  }
  return <RebetPlaying room={room} act={act} />;
}

function RebetLobby({ room, act, busy, themes, onExit }: { room: RebetRoomState; act: Act; busy: boolean; themes: Theme[]; onExit: () => void }) {
  const [settings, setSettings] = useState<RebetSettings>(room.settings);
  const names = themes.filter((theme) => room.settings.categories.includes(theme.id)).map((theme) => theme.name);

  function change(next: RebetSettings) {
    setSettings(next);
    void act("settings", next);
  }

  return (
    <RoomLobby
      room={room}
      minPlayers={2}
      busy={busy}
      summary={[
        `${room.settings.count} preguntas`,
        `Dificultad ${DIFFICULTY_LABEL[room.settings.difficulty]?.toLowerCase()}`,
        names.length ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` y ${names.length - 2} más` : "") : "Todos los temas",
      ]}
      settings={<RebetSetup themes={themes} counts={[5, 10, 15, 20]} value={settings} onChange={change} />}
      onStart={() => void act("start")}
      onKick={(id) => void act("kick", { player: id })}
      onLeave={onExit}
      onClose={() => window.confirm("¿Cerrar la sala para todos?") && void act("close")}
    />
  );
}

function RebetPlaying({ room, act }: { room: RebetRoomState; act: Act }) {
  const mine = room.mine;
  const [active, setActive] = useState<{ question: RebetQuestion; number: number } | null>(mine?.question ? { question: mine.question, number: mine.index + 1 } : null);
  const [tally, setTally] = useState({ score: mine?.score ?? 0, streak: mine?.streak ?? 0 });
  const asking = useRef(false);

  const ask = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const reply = await act("next");
    asking.current = false;
    if (reply.mine?.question) setActive({ question: reply.mine.question, number: reply.mine.index + 1 });
  }, [act]);

  useEffect(() => {
    if (active || !mine || mine.done) return;
    if (mine.question) setActive({ question: mine.question, number: mine.index + 1 });
    else void ask();
  }, [active, mine, ask]);

  const grade = useCallback(
    async (choice: number) => {
      const reply = await act("answer", { question: active?.question.id, choice });
      if (reply.result && reply.mine) setTally({ score: reply.mine.score, streak: reply.mine.streak });
      return (reply.result ?? { error: reply.error || "No se pudo enviar tu respuesta." }) as RebetGrade & { error?: string };
    },
    [act, active],
  );

  const board = room.board ?? [];

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div>
        {active ? (
          <RebetQuestionCard
            key={active.question.id}
            question={active.question}
            number={active.number}
            total={room.total ?? 0}
            score={tally.score}
            streak={tally.streak}
            grade={grade}
            onNext={() => setActive(null)}
            nextLabel={active.number < (room.total ?? 0) ? "Siguiente" : "Terminar"}
          />
        ) : mine?.done ? (
          <Rise className="game-dark p-8 text-center md:p-12">
            <p className="game-label">¡Terminaste!</p>
            <p className="editorial mt-4 text-6xl tabular-nums text-white md:text-7xl">{mine.score.toLocaleString("es-PE")}</p>
            <p className="mt-2 text-white/70">
              puntos · {mine.correct} de {room.total} correctas · mejor racha {mine.best}
            </p>
            <div className="mt-7 flex justify-center">
              <Waiting dark>Esperando a que los demás terminen…</Waiting>
            </div>
          </Rise>
        ) : (
          <div className="game-surface grid min-h-80 animate-pulse place-items-center p-10 text-muted">Cargando la siguiente pregunta…</div>
        )}
      </div>
      <aside className="lg:sticky lg:top-28">
        <div className="flex items-center justify-between">
          <p className="game-label">Marcador en vivo</p>
          {room.me.host ? (
            <button type="button" className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-sage hover:text-accent" onClick={() => window.confirm("¿Terminar la partida para todos ahora?") && void act("finish")}>
              Terminar para todos
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <Scoreboard rows={board} me={room.me.id} total={room.total} />
        </div>
      </aside>
    </div>
  );
}

function RebetFinal({ room, act, busy, onExit }: { room: RebetRoomState; act: Act; busy: boolean; onExit: () => void }) {
  const board = room.board ?? [];
  const winner = board[0];
  const mine = board.findIndex((row) => row.id === room.me.id);
  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-5">
      <Rise className="game-dark p-7 text-center md:p-10">
        <p className="game-label">Resultado final</p>
        <h2 className="editorial mt-3 text-[2.4rem] leading-tight text-white md:text-6xl">{winner ? `¡Ganó ${winner.name}!` : "Partida terminada"}</h2>
        {mine >= 0 ? <p className="mt-3 text-white/70">Quedaste en el puesto {mine + 1} de {board.length}.</p> : null}
        <div className="mx-auto mt-8 max-w-xl">
          <Podium rows={board} />
        </div>
      </Rise>
      <Scoreboard rows={board} me={room.me.id} total={room.total} />
      <EndActions
        busy={busy}
        onLobby={() => void act("lobby")}
        onExit={onExit}
        lobbyText="Todos regresan a la sala con el mismo código para jugar otra vez."
        exitText="Dejas la sala y vuelves al menú de REBET."
      />
      {room.me.host ? (
        <button type="button" className="justify-self-center text-sm font-semibold text-muted transition hover:text-accent" onClick={() => window.confirm("¿Cerrar la sala para todos?") && void act("close")}>
          Cerrar la sala para todos
        </button>
      ) : null}
    </div>
  );
}

/** The top three on steps of different heights: second, first, third. */
export function Podium({ rows }: { rows: { id: string; name: string; score: number }[] }) {
  const top = rows.slice(0, 3);
  if (top.length < 2) return null;
  const places = [top[1], top[0], top[2]];
  const heights = ["h-24", "h-32", "h-16"];
  const labels = [2, 1, 3];
  const tones = ["bg-white/15", "bg-accent", "bg-white/10"];
  return (
    <div className="game-podium">
      {places.map((row, index) =>
        row ? (
          <div key={row.id} className="game-pop flex flex-col items-center gap-2" style={{ animationDelay: `${index * 120}ms` }}>
            <Avatar name={row.name} size={labels[index] === 1 ? "xl" : "lg"} />
            <p className="max-w-full truncate text-sm font-semibold text-white">{row.name}</p>
            <p className="text-xs font-semibold tabular-nums text-white/70">{row.score.toLocaleString("es-PE")}</p>
            <div className={`step w-full ${heights[index]} ${tones[index]}`}>{labels[index]}</div>
          </div>
        ) : (
          <div key={`empty-${index}`} />
        ),
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { RebetQuestionCard } from "@/Components/games/rebet-question";
import { RebetSetup, type RebetSettings } from "@/Components/games/rebet-setup";
import { RoomLobby } from "@/Components/games/room-lobby";
import { Scoreboard, ghost, primary } from "@/Components/games/ui";
import { DIFFICULTY_LABEL, type RebetGrade, type RebetQuestion, type RebetRoomState, type Reply, type Theme } from "@/lib/games";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<Reply<RebetRoomState>>;

export function RebetRoomView({ room, act, busy, themes }: { room: RebetRoomState; act: Act; busy: boolean; themes: Theme[] }) {
  if (room.status === "lobby") {
    return <RebetLobby room={room} act={act} busy={busy} themes={themes} />;
  }
  if (room.status === "finished") {
    return <RebetPodium room={room} act={act} />;
  }
  return <RebetPlaying room={room} act={act} />;
}

function RebetLobby({ room, act, busy, themes }: { room: RebetRoomState; act: Act; busy: boolean; themes: Theme[] }) {
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
      summary={`REBET · ${room.settings.count} preguntas · ${DIFFICULTY_LABEL[room.settings.difficulty]} · ${names.length ? names.join(", ") : "todos los temas"}`}
      settings={<RebetSetup themes={themes} counts={[5, 10, 15, 20]} value={settings} onChange={change} />}
      onStart={() => void act("start")}
      onKick={(id) => void act("kick", { player: id })}
      onLeave={() => void act("leave")}
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

  function next() {
    setActive(null);
  }

  const board = room.board ?? [];

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
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
            onNext={next}
            nextLabel={active.number < (room.total ?? 0) ? "Siguiente" : "Terminar"}
          />
        ) : mine?.done ? (
          <Rise className="panel p-8 text-center md:p-12">
            <p className="kicker">¡Terminaste!</p>
            <p className="editorial mt-4 text-6xl tabular-nums text-ink">{mine.score.toLocaleString("es-PE")}</p>
            <p className="mt-2 text-muted">
              puntos · {mine.correct} de {room.total} correctas · mejor racha {mine.best}
            </p>
            <p className="mt-6 flex items-center justify-center gap-3 text-[15px] text-muted">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" /> Esperando a que los demás terminen…
            </p>
          </Rise>
        ) : (
          <div className="panel grid min-h-80 place-items-center p-10 text-muted">Cargando la siguiente pregunta…</div>
        )}
      </div>
      <aside>
        <div className="flex items-center justify-between">
          <p className="kicker">Marcador en vivo</p>
          {room.me.host ? (
            <button type="button" className="text-xs font-semibold text-muted hover:text-accent" onClick={() => window.confirm("¿Terminar la partida para todos ahora?") && void act("finish")}>
              Terminar para todos
            </button>
          ) : null}
        </div>
        <div className="mt-4">
          <Scoreboard rows={board} me={room.me.id} total={room.total} />
        </div>
      </aside>
    </div>
  );
}

function RebetPodium({ room, act }: { room: RebetRoomState; act: Act }) {
  const board = room.board ?? [];
  const winner = board[0];
  return (
    <Rise className="panel mx-auto mt-12 max-w-3xl p-7 md:p-10">
      <p className="kicker">Resultado final</p>
      <p className="editorial mt-3 text-5xl leading-tight text-ink">{winner ? `¡Ganó ${winner.name}!` : "Partida terminada"}</p>
      {winner ? <p className="mt-2 text-muted">{winner.score.toLocaleString("es-PE")} puntos · {winner.correct} correctas</p> : null}
      <div className="mt-8">
        <Scoreboard rows={board} me={room.me.id} total={room.total} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {room.me.host ? (
          <>
            <button type="button" className={primary} onClick={() => void act("lobby")}>Volver a la misma sala</button>
            <button type="button" className={ghost} onClick={() => window.confirm("¿Cerrar la sala para todos?") && void act("close")}>Cerrar sala</button>
          </>
        ) : (
          <p className="text-[15px] text-muted">El anfitrión puede volver a la sala para jugar otra partida con el mismo código.</p>
        )}
      </div>
    </Rise>
  );
}

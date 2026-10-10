import { useEffect, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { PlayerTile, RoundHistory, RoundOutcome, RoundTag, SpeakerRow, Verdict, WordSummary, maxRounds } from "@/Components/games/oculto-parts";
import { OcultoSettingsForm, type OcultoSettings } from "@/Components/games/oculto-settings";
import { RevealCard } from "@/Components/games/reveal-card";
import { RoomLobby } from "@/Components/games/room-lobby";
import { Alert, Avatar, Check, EndActions, Waiting, ghost, primary } from "@/Components/games/ui";
import { OCULTO_LEVELS, type OcultoRoomState, type OcultoRound, type Reply, type Theme } from "@/lib/games";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<Reply<OcultoRoomState>>;

const NEXT_ROUND_SECONDS = 8;

export function OcultoRoomView({ room, act, busy, themes, onExit }: { room: OcultoRoomState; act: Act; busy: boolean; themes: Theme[]; onExit: () => void }) {
  if (room.status === "lobby") return <OcultoLobby room={room} act={act} busy={busy} themes={themes} onExit={onExit} />;
  if (room.status === "result") return <OcultoResult room={room} act={act} busy={busy} onExit={onExit} />;
  return <OcultoPlaying key={room.round} room={room} act={act} busy={busy} />;
}

function OcultoLobby({ room, act, busy, themes, onExit }: { room: OcultoRoomState; act: Act; busy: boolean; themes: Theme[]; onExit: () => void }) {
  const [settings, setSettings] = useState<OcultoSettings>({ categories: room.settings.categories ?? [], impostors: room.settings.impostors ?? 1, level: room.settings.level ?? "intermedio" });
  const names = themes.filter((theme) => room.settings.categories.includes(theme.id)).map((theme) => theme.name);
  const seated = room.players.length;
  const rounds = maxRounds(Math.max(seated, 3));

  function change(next: OcultoSettings) {
    setSettings(next);
    void act("settings", next);
  }

  return (
    <RoomLobby
      room={room}
      minPlayers={3}
      busy={busy}
      notice={room.notice}
      summary={[
        `Nivel ${OCULTO_LEVELS.find((level) => level.key === room.settings.level)?.title.toLowerCase() ?? "intermedio"}`,
        seated >= 5 && room.settings.impostors === 2 ? "2 ocultos" : "1 oculto",
        `Hasta ${rounds} ${rounds === 1 ? "ronda" : "rondas"}`,
        names.length ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` y ${names.length - 2} más` : "") : "Todos los temas",
      ]}
      settings={<OcultoSettingsForm themes={themes} value={settings} onChange={change} players={seated} />}
      onStart={() => void act("start")}
      onKick={(id) => void act("kick", { player: id })}
      onLeave={onExit}
      onClose={() => window.confirm("¿Cerrar la sala para todos?") && void act("close")}
    />
  );
}

const roundEntry = (round: OcultoRound) => ({
  round: round.round,
  name: round.name,
  hidden: round.hidden,
  tally: round.tally.filter((row) => row.name).map((row) => ({ name: row.name as string, votes: row.votes })),
});

function OcultoPlaying({ room, act, busy }: { room: OcultoRoomState; act: Act; busy: boolean }) {
  const [suspect, setSuspect] = useState<string | null>(null);
  const nameOf = (id?: string | null) => room.players.find((player) => player.id === id)?.name ?? "Jugador";
  const alive = room.alive ?? [];
  const meIn = alive.includes(room.me.id);
  const voted = room.voted ?? [];
  const round = room.round ?? 1;
  const rounds = room.rounds ?? 1;
  const out = (room.order ?? []).filter((id) => !alive.includes(id) && room.players.some((player) => player.id === id)).map(nameOf);
  const speaker = room.speaker ?? null;
  const myTurn = speaker === room.me.id;

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="order-2 lg:order-1">
        <p className="game-label mb-3 text-center lg:text-left">Tu tarjeta</p>
        {room.card ? <RevealCard card={room.card} owner={room.me.name} /> : null}
      </div>

      <Rise key={`${room.status}-${round}`} className="game-surface order-1 p-6 md:p-9 lg:order-2">
        {!meIn ? (
          <div className="mb-6">
            <Alert tone="info">Saliste del juego en una ronda anterior. Sigue mirando: al final verás quién era el Cristiano Oculto.</Alert>
          </div>
        ) : null}

        {room.status === "clues" ? (
          <div className="text-center">
            <RoundTag round={round} rounds={rounds} label="Pistas" />
            <Avatar name={nameOf(speaker)} size="xl" className="mx-auto mt-7" />
            <h2 className="editorial mt-5 text-4xl leading-tight">{myTurn ? "Te toca dar tu pista" : `Turno de ${nameOf(speaker)}`}</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-muted">
              {myTurn ? "Di en voz alta una palabra o frase corta relacionada, sin decir la palabra secreta. Luego toca el botón." : "Escucha con atención: ¿su pista encaja con la palabra?"}
            </p>
            <div className="mt-7">
              <SpeakerRow names={alive.map(nameOf)} current={speaker ? alive.indexOf(speaker) : alive.length} out={out} me={room.me.name} />
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {myTurn ? (
                <button type="button" className={`${primary} w-full sm:w-auto`} disabled={busy} onClick={() => void act("spoke")}>
                  Ya di mi pista
                </button>
              ) : room.me.host ? (
                <button type="button" className={ghost} disabled={busy} onClick={() => void act("spoke")}>
                  Pasar el turno de {nameOf(speaker)}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {room.status === "voting" ? (
          <div>
            <div className="text-center">
              <RoundTag round={round} rounds={rounds} label="Votación" />
              {meIn && !room.my_vote ? (
                <>
                  <h2 className="editorial mt-5 text-[2.1rem] leading-tight md:text-[2.6rem]">¿Quién es el Cristiano Oculto?</h2>
                  <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-muted">Toca al jugador que crees que no conoce la palabra. Tu voto es secreto.</p>
                </>
              ) : (
                <>
                  <h2 className="editorial mt-5 text-[2.1rem] leading-tight">{room.my_vote ? `Votaste por ${nameOf(room.my_vote)}` : "Votación en curso"}</h2>
                  <div className="mt-4 flex justify-center">
                    <Waiting>
                      Han votado {voted.length} de {alive.length}. Esperando a los demás…
                    </Waiting>
                  </div>
                </>
              )}
            </div>
            {meIn && !room.my_vote ? (
              <>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {alive
                    .filter((id) => id !== room.me.id)
                    .map((id) => (
                      <PlayerTile key={id} name={nameOf(id)} selected={suspect === id} onClick={() => setSuspect(id)} />
                    ))}
                </div>
                <button type="button" className={`${primary} mt-6 w-full`} disabled={!suspect || busy} onClick={() => suspect && void act("vote", { player: suspect })}>
                  {suspect ? `Votar por ${nameOf(suspect)}` : "Elige a un jugador"}
                </button>
              </>
            ) : null}
            <ul className="mt-7 flex flex-wrap justify-center gap-2 border-t border-line pt-6">
              {alive.map((id) => (
                <li key={id} className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold ${voted.includes(id) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line text-muted"}`}>
                  <Avatar name={nameOf(id)} size="sm" />
                  {nameOf(id)}
                  {voted.includes(id) ? <Check className="h-3.5 w-3.5" /> : null}
                </li>
              ))}
            </ul>
            {room.me.host && voted.length > 0 && voted.length < alive.length ? (
              <div className="mt-5 text-center">
                <button type="button" className={ghost} disabled={busy} onClick={() => void act("reveal")}>
                  Cerrar la votación ahora
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {room.status === "reveal" && room.last ? (
          <RoundOutcome entry={roundEntry(room.last)}>
            <p className="mx-auto mt-7 max-w-md text-[15px] leading-7 text-muted">
              El Cristiano Oculto sigue entre ustedes. Quedan {alive.length} jugadores para la ronda {round + 1}.
            </p>
            <NextRound round={round} host={room.me.host} busy={busy} onContinue={() => act("continue", { round })} />
          </RoundOutcome>
        ) : null}
      </Rise>
    </div>
  );
}

/** Moves everyone to the next round after a few seconds; the host sends it first, the rest only if the host is away. */
function NextRound({ round, host, busy, onContinue }: { round: number; host: boolean; busy: boolean; onContinue: () => void }) {
  const [left, setLeft] = useState(NEXT_ROUND_SECONDS);
  const sent = useRef(false);
  const latest = useRef(onContinue);

  useEffect(() => {
    latest.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    const deadline = Date.now() + (NEXT_ROUND_SECONDS + (host ? 0 : 4)) * 1000;
    const timer = window.setInterval(() => {
      const seconds = Math.ceil((deadline - Date.now()) / 1000);
      setLeft(Math.max(0, Math.min(NEXT_ROUND_SECONDS, seconds)));
      if (seconds <= 0 && !sent.current) {
        sent.current = true;
        window.clearInterval(timer);
        latest.current();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [round, host]);

  return (
    <div className="mt-7 flex flex-col items-center gap-3">
      <button
        type="button"
        className={`${primary} w-full sm:w-auto`}
        disabled={busy}
        onClick={() => {
          sent.current = true;
          onContinue();
        }}
      >
        Empezar la ronda {round + 1}
      </button>
      <p className="text-sm text-muted">{left > 0 ? `Empieza sola en ${left} s` : "Empezando…"}</p>
    </div>
  );
}

function OcultoResult({ room, act, busy, onExit }: { room: OcultoRoomState; act: Act; busy: boolean; onExit: () => void }) {
  const outcome = room.outcome;
  if (!outcome) return null;
  const history = outcome.history.map(roundEntry);
  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-5">
      <Verdict winner={outcome.winner} impostors={outcome.impostors.map((player) => player.name ?? "Jugador")} mine={{ impostor: Boolean(room.card?.impostor) }} />
      <div className="grid gap-5 md:grid-cols-2">
        {room.card?.word ? <WordSummary word={room.card} /> : null}
        <RoundHistory rounds={history} />
      </div>
      <EndActions
        busy={busy}
        onLobby={() => void act("lobby")}
        onExit={onExit}
        lobbyText="Todos regresan a la sala con el mismo código para jugar otra vez."
        exitText="Dejas la sala y vuelves al menú del juego."
      />
    </div>
  );
}

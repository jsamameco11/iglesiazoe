import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { WordSummary } from "@/Components/games/oculto-local";
import { OcultoSettingsForm, type OcultoSettings } from "@/Components/games/oculto-settings";
import { RevealCard } from "@/Components/games/reveal-card";
import { RoomLobby } from "@/Components/games/room-lobby";
import { Alert, ghost, primary } from "@/Components/games/ui";
import type { OcultoRoomState, Reply, Theme } from "@/lib/games";

type Act = (action: string, payload?: Record<string, unknown>) => Promise<Reply<OcultoRoomState>>;

export function OcultoRoomView({ room, act, busy, themes }: { room: OcultoRoomState; act: Act; busy: boolean; themes: Theme[] }) {
  if (room.status === "lobby") return <OcultoLobby room={room} act={act} busy={busy} themes={themes} />;
  if (room.status === "result") return <OcultoResult room={room} act={act} busy={busy} />;
  return <OcultoPlaying key={room.round} room={room} act={act} busy={busy} />;
}

function OcultoLobby({ room, act, busy, themes }: { room: OcultoRoomState; act: Act; busy: boolean; themes: Theme[] }) {
  const [settings, setSettings] = useState<OcultoSettings>(room.settings);
  const names = themes.filter((theme) => room.settings.categories.includes(theme.id)).map((theme) => theme.name);

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
      summary={`${room.settings.impostors === 2 ? "2 ocultos" : "1 oculto"} · ${room.settings.clue_rounds} ${room.settings.clue_rounds === 1 ? "vuelta" : "vueltas"} de pistas · ${names.length ? names.join(", ") : "todos los temas"}`}
      settings={<OcultoSettingsForm themes={themes} value={settings} onChange={change} />}
      onStart={() => void act("start")}
      onKick={(id) => void act("kick", { player: id })}
      onLeave={() => void act("leave")}
      onClose={() => window.confirm("¿Cerrar la sala para todos?") && void act("close")}
    />
  );
}

function OcultoPlaying({ room, act, busy }: { room: OcultoRoomState; act: Act; busy: boolean }) {
  const [suspect, setSuspect] = useState<string | null>(null);
  const nameOf = (id?: string | null) => room.players.find((player) => player.id === id)?.name ?? "";
  const order = room.order ?? [];
  const speaker = room.speaker;
  const myTurn = speaker === room.me.id;
  const voting = room.status === "voting";
  const voted = room.voted ?? [];
  const showEscape = room.escaped && room.round && room.escaped.round === room.round - 1 && room.status === "clues";

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <div>{room.card ? <RevealCard key={`${room.round}-${room.card.impostor}`} card={room.card} /> : null}</div>

      <Rise className="panel p-7 md:p-9">
        <p className="kicker">
          Ronda {room.round} de {room.rounds}
          {!voting ? ` · Vuelta ${room.pass} de ${room.settings.clue_rounds}` : " · Votación"}
        </p>

        {showEscape ? (
          <div className="mt-5">
            <Alert tone="info">
              <strong>¡Escapó!</strong> {room.escaped?.top ? `La mayoría señaló a ${room.escaped.top}, pero no era.` : "No hubo una mayoría clara."} Misma palabra, nueva ronda de pistas.
            </Alert>
          </div>
        ) : null}

        {!voting ? (
          <>
            <h2 className="editorial mt-4 text-4xl leading-tight text-ink">{myTurn ? "Te toca dar tu pista" : `Turno de ${nameOf(speaker)}`}</h2>
            <p className="mt-3 text-[15px] leading-7 text-muted">
              {myTurn ? "Di en voz alta una palabra o frase corta relacionada, sin decir la palabra secreta. Luego toca el botón." : "Escucha con atención: ¿su pista encaja con la palabra?"}
            </p>
            <ol className="mt-6 flex flex-wrap gap-2">
              {order.map((id) => (
                <li key={id} className={`rounded-full px-3 py-1 text-xs font-medium ${id === speaker ? "bg-accent text-white" : "border border-line text-muted"}`}>
                  {nameOf(id)}
                  {id === room.me.id ? " (tú)" : ""}
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              {myTurn ? (
                <button type="button" className={primary} disabled={busy} onClick={() => void act("spoke")}>Ya di mi pista</button>
              ) : room.me.host ? (
                <button type="button" className={ghost} disabled={busy} onClick={() => void act("spoke")}>Pasar el turno de {nameOf(speaker)}</button>
              ) : null}
            </div>
          </>
        ) : room.my_vote ? (
          <>
            <h2 className="editorial mt-4 text-4xl leading-tight text-ink">Votaste por {nameOf(room.my_vote)}</h2>
            <p className="mt-3 flex items-center gap-3 text-[15px] text-muted">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
              Han votado {voted.length} de {order.length}. Esperando a los demás…
            </p>
            {room.me.host && voted.length < order.length ? (
              <button type="button" className={`${ghost} mt-7`} disabled={busy} onClick={() => void act("reveal")}>Cerrar la votación ahora</button>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="editorial mt-4 text-4xl leading-tight text-ink">¿Quién es el Cristiano Oculto?</h2>
            <p className="mt-3 text-[15px] leading-7 text-muted">Tu voto es secreto. Han votado {voted.length} de {order.length}.</p>
            <div className="mt-6 grid gap-2">
              {order
                .filter((id) => id !== room.me.id)
                .map((id) => (
                  <button key={id} type="button" onClick={() => setSuspect(id)} className={`rounded-2xl border px-5 py-3.5 text-left font-medium transition ${suspect === id ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink/30"}`}>
                    {nameOf(id)}
                  </button>
                ))}
            </div>
            <button type="button" className={`${primary} mt-6 w-full`} disabled={!suspect || busy} onClick={() => suspect && void act("vote", { player: suspect })}>Confirmar voto</button>
          </>
        )}
      </Rise>
    </div>
  );
}

function OcultoResult({ room, act, busy }: { room: OcultoRoomState; act: Act; busy: boolean }) {
  const outcome = room.outcome;
  if (!outcome) return null;
  return (
    <Rise className="panel mx-auto mt-12 max-w-2xl p-7 text-center md:p-10">
      <p className="kicker">Resultado</p>
      <p className={`editorial mt-4 text-5xl leading-tight ${outcome.caught ? "text-ink" : "text-accent"}`}>{outcome.caught ? "¡Lo descubrieron!" : "¡Ganó el Cristiano Oculto!"}</p>
      <p className="mt-4 text-[15px] leading-7 text-muted">
        {outcome.impostors.length > 1 ? "Los cristianos ocultos eran" : "El Cristiano Oculto era"} <strong className="text-ink">{outcome.impostors.join(" y ")}</strong>
        {room.card?.impostor ? " (¡tú!)" : ""}.
      </p>
      {outcome.tally.length ? (
        <ul className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
          {outcome.tally.map((row) => (
            <li key={row.name} className="rounded-full bg-sage px-3 py-1 text-xs font-medium text-ink">
              {row.name}: {row.votes} {row.votes === 1 ? "voto" : "votos"}
            </li>
          ))}
        </ul>
      ) : null}
      {room.card?.word ? <WordSummary word={room.card} /> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {room.me.host ? (
          <>
            <button type="button" className={primary} disabled={busy} onClick={() => void act("again")}>Otra partida</button>
            <button type="button" className={ghost} disabled={busy} onClick={() => void act("lobby")}>Volver a la sala</button>
          </>
        ) : (
          <p className="text-[15px] text-muted">Esperando a que el anfitrión empiece otra partida…</p>
        )}
      </div>
    </Rise>
  );
}

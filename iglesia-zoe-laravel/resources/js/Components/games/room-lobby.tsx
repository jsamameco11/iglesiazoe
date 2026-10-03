import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { Alert, ghost, primary } from "@/Components/games/ui";
import type { RoomBase } from "@/lib/games";

/** Waiting room of a live game: the code to share, who is in, and the host's controls. */
export function RoomLobby({
  room,
  minPlayers,
  busy,
  notice,
  settings,
  summary,
  onStart,
  onKick,
  onLeave,
  onClose,
}: {
  room: RoomBase;
  minPlayers: number;
  busy: boolean;
  notice?: string | null;
  settings: React.ReactNode;
  summary: string;
  onStart: () => void;
  onKick: (id: string) => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const host = room.players.find((player) => player.host);
  const missing = Math.max(0, minPlayers - room.players.length);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/juegos/sala/${room.code}`;

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Únete a mi sala", text: `Entra a la sala ${room.code}`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Rise className="panel p-7 text-center md:p-9">
        <p className="kicker">Código de la sala</p>
        <p className="editorial mt-4 select-all text-6xl tracking-[0.12em] text-ink md:text-7xl">{room.code}</p>
        <p className="mx-auto mt-4 max-w-xs text-[15px] leading-7 text-muted">Entren a esta página desde su celular y escriban el código, o compartan el enlace.</p>
        <button type="button" onClick={() => void share()} className={`${ghost} mt-6`}>
          {copied ? "Enlace copiado ✓" : "Compartir enlace"}
        </button>
        <p className="mt-6 text-sm text-muted">{summary}</p>
      </Rise>

      <Rise delay={80} className="panel p-7 md:p-9">
        <div className="flex items-center justify-between gap-3">
          <h2 className="editorial text-3xl text-ink">Jugadores</h2>
          <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold text-ink">
            {room.players.length} / {room.max}
          </span>
        </div>
        <ul className="mt-6 grid gap-2">
          {room.players.map((player) => (
            <li key={player.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${player.id === room.me.id ? "border-accent/40 bg-accent-soft" : "border-line bg-card"}`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-semibold uppercase text-paper">{player.name.slice(0, 1)}</span>
              <span className="flex-1 font-medium text-ink">
                {player.name}
                {player.id === room.me.id ? <span className="ml-2 text-xs text-muted">(tú)</span> : null}
              </span>
              {player.host ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white">Anfitrión</span> : null}
              {room.me.host && !player.host ? (
                <button type="button" onClick={() => onKick(player.id)} className="text-sm text-muted hover:text-accent" aria-label={`Sacar a ${player.name}`}>
                  Sacar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {notice ? <div className="mt-5"><Alert tone="info">{notice}</Alert></div> : null}
        {room.me.host ? (
          <div className="mt-8 border-t border-line pt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Ajustes de la partida</p>
            <div className="mt-5">{settings}</div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" className={primary} disabled={busy || missing > 0} onClick={onStart}>
                {missing > 0 ? `Faltan ${missing} ${missing === 1 ? "jugador" : "jugadores"}` : "Empezar partida"}
              </button>
              <button type="button" className={ghost} onClick={onClose}>Cerrar sala</button>
            </div>
          </div>
        ) : (
          <div className="mt-8 border-t border-line pt-7">
            <p className="flex items-center gap-3 text-[15px] text-muted">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
              Esperando a que {host?.name ?? "el anfitrión"} empiece la partida…
            </p>
            <button type="button" className={`${ghost} mt-6`} onClick={onLeave}>Salir de la sala</button>
          </div>
        )}
      </Rise>
    </div>
  );
}

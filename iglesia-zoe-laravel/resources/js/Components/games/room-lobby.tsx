import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { Alert, Avatar, Waiting, ghost, onDark, primary } from "@/Components/games/ui";
import { roomUrl, type RoomBase } from "@/lib/games";

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
  summary: string[];
  onStart: () => void;
  onKick: (id: string) => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const host = room.players.find((player) => player.host);
  const missing = Math.max(0, minPlayers - room.players.length);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${roomUrl(room.game, room.code)}`;

  async function copy(what: "code" | "link") {
    await navigator.clipboard?.writeText(what === "code" ? room.code : url).catch(() => undefined);
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Únete a mi sala", text: `Entra a mi sala con el código ${room.code}`, url }).catch(() => undefined);
      return;
    }
    await copy("link");
  }

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="grid gap-6">
        <Rise className="game-dark p-7 text-center md:p-9">
          <p className="game-label">Código de la sala</p>
          <button type="button" onClick={() => void copy("code")} className="game-code mx-auto mt-4 block select-all text-[3.4rem] leading-none text-white transition hover:opacity-85 md:text-7xl" title="Copiar código">
            {room.code}
          </button>
          <p className="mx-auto mt-4 max-w-xs text-[15px] leading-7 text-white/70">Los demás entran a este juego desde su celular y escriben el código, o abren el enlace.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void share()} className={onDark}>
              {copied === "link" ? "Enlace copiado ✓" : "Compartir enlace"}
            </button>
            <button type="button" onClick={() => void copy("code")} className={onDark}>
              {copied === "code" ? "Código copiado ✓" : "Copiar código"}
            </button>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-2">
            {summary.map((item) => (
              <li key={item} className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-white/80">
                {item}
              </li>
            ))}
          </ul>
        </Rise>

        <Rise delay={60} className="game-surface p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="editorial text-2xl">Jugadores</h2>
            <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold tabular-nums text-ink">
              {room.players.length} / {room.max}
            </span>
          </div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {room.players.map((player) => (
              <li key={player.id} className={`game-pop flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${player.id === room.me.id ? "border-accent/40 bg-accent-soft" : "border-line bg-card"}`}>
                <Avatar name={player.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{player.name}</span>
                  <span className="block text-xs text-muted">{player.host ? "Anfitrión" : player.id === room.me.id ? "Tú" : "Listo"}</span>
                </span>
                {room.me.host && !player.host ? (
                  <button type="button" onClick={() => onKick(player.id)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-sage hover:text-accent" aria-label={`Sacar a ${player.name}`}>
                    Sacar
                  </button>
                ) : null}
              </li>
            ))}
            {Array.from({ length: missing }, (_, index) => (
              <li key={`empty-${index}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-2.5 text-sm text-muted">
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-dashed border-line">+</span>
                Esperando jugador…
              </li>
            ))}
          </ul>
          {notice ? <div className="mt-5"><Alert tone="info">{notice}</Alert></div> : null}
        </Rise>
      </div>

      <Rise delay={120} className="game-surface p-6 md:p-8">
        {room.me.host ? (
          <>
            <p className="game-label">Tú abriste la sala</p>
            <h2 className="editorial mt-2 text-3xl">Ajustes de la partida</h2>
            <div className="mt-7">{settings}</div>
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-7">
              <button type="button" className={`${primary} flex-1 sm:flex-none`} disabled={busy || missing > 0} onClick={onStart}>
                {missing > 0 ? `Faltan ${missing} ${missing === 1 ? "jugador" : "jugadores"}` : "Empezar partida"}
              </button>
              <button type="button" className={ghost} onClick={onClose}>
                Cerrar sala
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            {host ? <Avatar name={host.name} size="xl" className="mx-auto" /> : null}
            <h2 className="editorial mt-6 text-3xl">Ya estás dentro</h2>
            <div className="mt-4 flex justify-center">
              <Waiting>Esperando a que {host?.name ?? "el anfitrión"} empiece la partida…</Waiting>
            </div>
            <ul className="mx-auto mt-6 flex max-w-sm flex-wrap justify-center gap-2">
              {summary.map((item) => (
                <li key={item} className="rounded-full bg-sage/80 px-3 py-1 text-xs font-medium text-ink/80">
                  {item}
                </li>
              ))}
            </ul>
            <button type="button" className={`${ghost} mt-8`} onClick={onLeave}>
              Salir de la sala
            </button>
          </div>
        )}
      </Rise>
    </div>
  );
}

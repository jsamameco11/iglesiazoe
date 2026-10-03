import { Link } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { OcultoRoomView } from "@/Components/games/oculto-room";
import { RebetRoomView } from "@/Components/games/rebet-room";
import { useRoom } from "@/Components/games/use-room";
import { Alert, GamePage, field, ghost, primary } from "@/Components/games/ui";
import { playerName, postJson, roomToken, type OcultoRoomState, type RebetRoomState, type RoomBase, type Theme } from "@/lib/games";

type Props = { code: string; game: "rebet" | "oculto" | null; joinable: boolean; rebetThemes: Theme[]; ocultoThemes: Theme[] };

const TITLES = { rebet: "REBET", oculto: "El Cristiano Oculto" };

export default function Room({ code, game, joinable, rebetThemes, ocultoThemes }: Props) {
  const [token, setToken] = useState(() => roomToken.get(code));

  if (!game) {
    return (
      <GamePage kicker="Juegos · Sala" title="Sala no encontrada" back={{ href: "/juegos", label: "Juegos" }}>
        <Rise className="panel mt-12 max-w-xl p-8 md:p-10">
          <p className="text-[15px] leading-7 text-muted">
            No encontramos la sala <strong className="text-ink">{code}</strong>. Revisa el código o pide que te lo compartan otra vez; las salas se cierran solas después de unas horas sin jugar.
          </p>
          <Link href="/juegos" className={`${primary} mt-7`}>Ver los juegos</Link>
        </Rise>
      </GamePage>
    );
  }

  return token ? (
    <LiveRoom code={code} game={game} token={token} onGone={() => setToken(null)} themes={game === "rebet" ? rebetThemes : ocultoThemes} />
  ) : (
    <JoinRoom code={code} game={game} joinable={joinable} onJoined={setToken} />
  );
}

function JoinRoom({ code, game, joinable, onJoined }: { code: string; game: "rebet" | "oculto"; joinable: boolean; onJoined: (token: string) => void }) {
  const [name, setName] = useState(playerName.get());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const reply = await postJson<{ token: string }>(`/juegos/salas/${code}/entrar`, { name });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(name);
    roomToken.set(code, reply.token);
    onJoined(reply.token);
  }

  return (
    <GamePage kicker={`Juegos · ${TITLES[game]}`} title={`Sala ${code}`} back={{ href: "/juegos", label: "Juegos" }}>
      <Rise className="panel mx-auto mt-12 max-w-lg p-7 md:p-10">
        {joinable ? (
          <form onSubmit={join} className="grid gap-5">
            <div>
              <p className="kicker">Entrar a la sala</p>
              <h2 className="editorial mt-3 text-3xl text-ink">¿Cómo te llamas?</h2>
              <p className="mt-2 text-[15px] leading-7 text-muted">Así te verán los demás jugadores.</p>
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Tu nombre" autoFocus className={field} />
            {error ? <Alert>{error}</Alert> : null}
            <button className={primary} disabled={busy || name.trim().length < 2}>{busy ? "Entrando…" : `Entrar a ${TITLES[game]}`}</button>
          </form>
        ) : (
          <>
            <p className="kicker">Partida en curso</p>
            <p className="mt-3 text-[15px] leading-7 text-muted">Esta sala ya está jugando. Podrás entrar cuando el anfitrión vuelva a la sala para otra partida.</p>
            <button type="button" className={`${ghost} mt-6`} onClick={() => window.location.reload()}>Volver a intentar</button>
          </>
        )}
      </Rise>
    </GamePage>
  );
}

function LiveRoom({ code, game, token, themes, onGone }: { code: string; game: "rebet" | "oculto"; token: string; themes: Theme[]; onGone: () => void }) {
  const { room, link, offline, error, setError, busy, act } = useRoom<RoomBase>(code, token);

  if (link !== "live") {
    return (
      <GamePage kicker={`Juegos · ${TITLES[game]}`} title={link === "closed" ? "La sala se cerró" : "Saliste de la sala"} back={{ href: "/juegos", label: "Juegos" }}>
        <Rise className="panel mt-12 max-w-xl p-8 md:p-10">
          <p className="text-[15px] leading-7 text-muted">{link === "closed" ? "El anfitrión cerró esta sala. ¡Gracias por jugar!" : "Ya no estás en esta sala. Puedes volver a entrar si la partida no ha empezado."}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {link === "gone" ? <button type="button" className={primary} onClick={onGone}>Volver a entrar</button> : null}
            <Link href={game === "rebet" ? "/juegos/rebet" : "/juegos/el-cristiano-oculto"} className={ghost}>Abrir otra sala</Link>
          </div>
        </Rise>
      </GamePage>
    );
  }

  return (
    <GamePage
      kicker={`Juegos · ${TITLES[game]} · Sala ${code}`}
      title={TITLES[game]}
      aside={
        room ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold tracking-[0.18em] text-ink">{code}</span>
            {room.status !== "lobby" ? (
              <button type="button" className="text-sm font-medium text-muted hover:text-accent" onClick={() => window.confirm("¿Salir de la partida?") && void act("leave")}>
                Salir
              </button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {offline ? <div className="mt-8"><Alert tone="info">Sin conexión. Reintentando…</Alert></div> : null}
      {error ? (
        <div className="mt-8 flex items-start gap-3">
          <div className="flex-1"><Alert>{error}</Alert></div>
          <button type="button" className="pt-3 text-sm text-muted" onClick={() => setError("")} aria-label="Cerrar aviso">✕</button>
        </div>
      ) : null}
      {!room ? (
        <div className="panel mt-12 grid min-h-72 animate-pulse place-items-center p-10 text-muted">Entrando a la sala…</div>
      ) : room.game === "rebet" ? (
        <RebetRoomView room={room as RebetRoomState} act={act as never} busy={busy} themes={themes} />
      ) : (
        <OcultoRoomView room={room as OcultoRoomState} act={act as never} busy={busy} themes={themes} />
      )}
    </GamePage>
  );
}

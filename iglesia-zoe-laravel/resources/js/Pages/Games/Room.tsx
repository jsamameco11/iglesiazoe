import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { OcultoRoomView } from "@/Components/games/oculto-room";
import { RebetRoomView } from "@/Components/games/rebet-room";
import { useRoom } from "@/Components/games/use-room";
import { Alert, Avatar, GameEmblem, GamePage, field, ghost, primary, useScreenTop } from "@/Components/games/ui";
import { GAME_PATH, GAME_TITLE, playerName, postJson, roomToken, roomUrl, type OcultoRoomState, type RebetRoomState, type RoomBase, type RoomGame, type Theme } from "@/lib/games";

type Props = { code: string; game: RoomGame; found: boolean; elsewhere: RoomGame | null; joinable: boolean; themes: Theme[] };

export default function Room({ code, game, found, elsewhere, joinable, themes }: Props) {
  const [token, setToken] = useState(() => roomToken.get(code));
  const back = { href: GAME_PATH[game], label: GAME_TITLE[game] };

  if (!found) {
    return (
      <GamePage compact kicker={`${GAME_TITLE[game]} · Sala`} title={elsewhere ? "Ese código es de otro juego" : "Sala no encontrada"} back={back}>
        <Rise className="game-surface mx-auto mt-10 max-w-xl p-8 text-center md:p-10">
          <GameEmblem game={elsewhere ?? game} className="mx-auto h-16 w-16" />
          <p className="mt-6 text-[15px] leading-7 text-muted">
            {elsewhere ? (
              <>
                El código <strong className="text-ink">{code}</strong> es de una sala de <strong className="text-ink">{GAME_TITLE[elsewhere]}</strong>, no de {GAME_TITLE[game]}. Cada juego tiene sus propios códigos.
              </>
            ) : (
              <>
                No encontramos la sala <strong className="text-ink">{code}</strong>. Revisa el código o pide que te lo compartan otra vez; las salas se cierran solas después de unas horas sin jugar.
              </>
            )}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {elsewhere ? (
              <Link href={roomUrl(elsewhere, code)} className={primary}>
                Ir a {GAME_TITLE[elsewhere]}
              </Link>
            ) : null}
            <Link href={GAME_PATH[game]} className={elsewhere ? ghost : primary}>
              Volver a {GAME_TITLE[game]}
            </Link>
          </div>
        </Rise>
      </GamePage>
    );
  }

  return token ? <LiveRoom code={code} game={game} token={token} onGone={() => setToken(null)} themes={themes} /> : <JoinRoom code={code} game={game} joinable={joinable} onJoined={setToken} />;
}

function JoinRoom({ code, game, joinable, onJoined }: { code: string; game: RoomGame; joinable: boolean; onJoined: (token: string) => void }) {
  const [name, setName] = useState(playerName.get());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const reply = await postJson<{ token: string }>(`/juegos/salas/${code}/entrar`, { name, game });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(name);
    roomToken.set(code, reply.token);
    onJoined(reply.token);
  }

  return (
    <GamePage compact kicker={`${GAME_TITLE[game]} · Sala ${code}`} title="Entrar a la sala" back={{ href: GAME_PATH[game], label: GAME_TITLE[game] }}>
      <Rise className="game-surface mx-auto mt-10 max-w-lg p-7 md:p-10">
        <div className="text-center">
          <GameEmblem game={game} className="mx-auto h-14 w-14" />
          <p className="game-code mt-5 text-4xl text-ink">{code}</p>
        </div>
        {joinable ? (
          <form onSubmit={join} className="mt-8 grid gap-4">
            <div className="text-center">
              <h2 className="editorial text-3xl">¿Cómo te llamas?</h2>
              <p className="mt-2 text-[15px] leading-7 text-muted">Así te verán los demás jugadores.</p>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={name.trim() || "?"} />
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Tu nombre" autoFocus autoComplete="nickname" className={field} />
            </div>
            {error ? <Alert>{error}</Alert> : null}
            <button className={primary} disabled={busy || name.trim().length < 2}>
              {busy ? "Entrando…" : `Entrar a ${GAME_TITLE[game]}`}
            </button>
          </form>
        ) : (
          <div className="mt-8 text-center">
            <h2 className="editorial text-2xl">Partida en curso</h2>
            <p className="mt-3 text-[15px] leading-7 text-muted">Esta sala ya está jugando. Podrás entrar cuando vuelvan a la sala para otra partida.</p>
            <button type="button" className={`${ghost} mt-6`} onClick={() => window.location.reload()}>
              Volver a intentar
            </button>
          </div>
        )}
      </Rise>
    </GamePage>
  );
}

function LiveRoom({ code, game, token, themes, onGone }: { code: string; game: RoomGame; token: string; themes: Theme[]; onGone: () => void }) {
  const { room, link, offline, error, setError, busy, act } = useRoom<RoomBase>(code, token);
  const back = { href: GAME_PATH[game], label: GAME_TITLE[game] };
  useScreenTop(`${room?.status ?? ""}-${(room as OcultoRoomState | null)?.round ?? ""}`);

  async function exit() {
    await act("leave");
    roomToken.forget(code);
    router.visit(GAME_PATH[game]);
  }

  if (link !== "live") {
    return (
      <GamePage compact kicker={`${GAME_TITLE[game]} · Sala ${code}`} title={link === "closed" ? "La sala se cerró" : "Saliste de la sala"} back={back}>
        <Rise className="game-surface mx-auto mt-10 max-w-xl p-8 text-center md:p-10">
          <GameEmblem game={game} className="mx-auto h-16 w-16" />
          <p className="mt-6 text-[15px] leading-7 text-muted">{link === "closed" ? "El anfitrión cerró esta sala. ¡Gracias por jugar!" : "Ya no estás en esta sala. Puedes volver a entrar si la partida no ha empezado."}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {link === "gone" ? (
              <button type="button" className={primary} onClick={onGone}>
                Volver a entrar
              </button>
            ) : null}
            <Link href={GAME_PATH[game]} className={link === "gone" ? ghost : primary}>
              Volver a {GAME_TITLE[game]}
            </Link>
          </div>
        </Rise>
      </GamePage>
    );
  }

  return (
    <GamePage
      compact
      kicker={`Sala en vivo · ${room ? `${room.players.length} ${room.players.length === 1 ? "jugador" : "jugadores"}` : "conectando"}`}
      title={GAME_TITLE[game]}
      back={back}
      aside={
        room ? (
          <div className="flex items-center gap-2">
            <span className="game-code rounded-full border border-line bg-card px-4 py-2 text-sm text-ink">{code}</span>
            {room.status !== "lobby" ? (
              <button type="button" className="min-h-10 rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-sage hover:text-accent" onClick={() => window.confirm("¿Salir de la partida?") && void exit()}>
                Salir
              </button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {offline ? <div className="mt-6"><Alert tone="info">Sin conexión. Reintentando…</Alert></div> : null}
      {error ? (
        <div className="mt-6 flex items-start gap-3">
          <div className="flex-1">
            <Alert>{error}</Alert>
          </div>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sage" onClick={() => setError("")} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      ) : null}
      {!room ? (
        <div className="game-surface mt-8 grid min-h-72 animate-pulse place-items-center p-10 text-muted">Entrando a la sala…</div>
      ) : room.game === "rebet" ? (
        <RebetRoomView room={room as RebetRoomState} act={act as never} busy={busy} themes={themes} onExit={() => void exit()} />
      ) : (
        <OcultoRoomView room={room as OcultoRoomState} act={act as never} busy={busy} themes={themes} onExit={() => void exit()} />
      )}
    </GamePage>
  );
}

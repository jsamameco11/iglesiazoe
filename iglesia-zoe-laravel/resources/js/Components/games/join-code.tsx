import { router } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { ArrowRight, darkField, primary } from "@/Components/games/ui";
import { GAME_TITLE, playerName, postJson, roomToken, roomUrl, type RoomGame } from "@/lib/games";

/** Enter a live room of this game with the code a friend shares; codes of other games are turned away. */
export function JoinByCode({ game }: { game: RoomGame }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(playerName.get());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 3) return setError("Escribe el código que aparece en la pantalla de quien abrió la sala.");
    if (roomToken.get(clean)) return router.visit(roomUrl(game, clean));
    if (name.trim().length < 2) return setError("Escribe tu nombre (al menos 2 letras).");
    setBusy(true);
    const reply = await postJson<{ code: string; token: string }>(`/juegos/salas/${clean}/entrar`, { name, game });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(name);
    roomToken.set(reply.code, reply.token);
    router.visit(roomUrl(game, reply.code));
  }

  return (
    <Rise className="game-dark mt-6 p-6 md:p-10">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        <div>
          <p className="game-label">Unirme a una sala</p>
          <h2 className="editorial mt-3 text-3xl leading-tight text-white md:text-4xl">¿Te pasaron un código?</h2>
          <p className="mt-3 max-w-md text-[15px] leading-7 text-white/70">
            Escribe el código que ve en su pantalla quien abrió la sala de {GAME_TITLE[game]}. Aquí solo entran códigos de este juego.
          </p>
        </div>
        <form onSubmit={join} className="grid gap-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <label className="grid gap-2">
              <span className="game-label">Código</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Za-z0-9]/g, ""))}
                placeholder="LUZ482"
                maxLength={12}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className={`${darkField} game-code text-center text-xl`}
              />
            </label>
            <label className="grid gap-2">
              <span className="game-label">Tu nombre</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Ej. Hna. Rocío" autoComplete="nickname" className={darkField} />
            </label>
          </div>
          {error ? <p role="alert" className="rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white">{error}</p> : null}
          <button className={`${primary} w-full sm:w-auto sm:justify-self-start`} disabled={busy || code.trim().length < 3}>
            {busy ? "Entrando…" : "Entrar a la sala"} <ArrowRight />
          </button>
        </form>
      </div>
    </Rise>
  );
}

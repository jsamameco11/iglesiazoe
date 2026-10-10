import { router } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { JoinByCode } from "@/Components/games/join-code";
import { OcultoLocal } from "@/Components/games/oculto-local";
import { OCULTO_DEFAULTS, OcultoSettingsForm, type OcultoSettings } from "@/Components/games/oculto-settings";
import { Alert, Avatar, Field, GameEmblem, GamePage, GroupIcon, ModeCard, PhoneIcon, Steps, field, ghost, primary, useScreenTop } from "@/Components/games/ui";
import { playerName, postJson, roomToken, roomUrl, type Theme } from "@/lib/games";

type Mode = "menu" | "local" | "sala";

const STEPS: [string, string][] = [
  ["Reparte", "Cada jugador abre su tarjeta. Todos ven la palabra secreta, menos el Cristiano Oculto, que solo ve el tema."],
  ["Da una pista", "Por turnos, cada uno dice una pista corta sin decir la palabra. El oculto improvisa."],
  ["Vota", "Al terminar la ronda, toquen al jugador que creen que es el Cristiano Oculto. El más votado sale."],
  ["Descubre", "Si era el oculto, ganan. Si no, sigue otra ronda: 3 jugadores juegan 1 ronda, 4 juegan hasta 2, y así."],
];

export default function Oculto({ themes }: { themes: Theme[] }) {
  const [mode, setMode] = useState<Mode>("menu");
  useScreenTop(mode);
  const [name, setName] = useState(playerName.get());
  const [settings, setSettings] = useState<OcultoSettings>(OCULTO_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const menu = mode === "menu";

  async function openRoom() {
    setError("");
    if (name.trim().length < 2) return setError("Escribe tu nombre para abrir la sala.");
    setBusy(true);
    const reply = await postJson<{ code: string; token: string }>("/juegos/salas", { game: "oculto", name, settings });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(name);
    roomToken.set(reply.code, reply.token);
    router.visit(roomUrl("oculto", reply.code));
  }

  return (
    <GamePage
      compact={!menu}
      kicker={menu ? "Juegos · El Cristiano Oculto" : mode === "local" ? "Un solo celular" : "Sala en vivo"}
      title="El Cristiano Oculto"
      text={menu ? "Todos conocen la palabra secreta menos uno. Den pistas, sospechen y voten antes de que escape." : undefined}
      back={menu ? { href: "/juegos", label: "Juegos" } : undefined}
      aside={
        menu ? (
          <GameEmblem game="oculto" className="hidden h-24 w-24 lg:block" />
        ) : (
          <button type="button" className={ghost} onClick={() => setMode("menu")}>
            Cambiar modo
          </button>
        )
      }
    >
      {menu ? (
        <>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <ModeCard
              icon={<PhoneIcon />}
              title="Un solo celular"
              text="Para jugar sentados juntos: el celular pasa de mano en mano para ver las tarjetas, y el grupo vota tocando al sospechoso."
              tags={["De 3 a 15 jugadores", "Sin internet entre turnos"]}
              onClick={() => setMode("local")}
            />
            <ModeCard
              icon={<GroupIcon />}
              title="Sala en vivo"
              text="Cada uno con su celular: abres una sala, compartes el código y todos ven su tarjeta y votan desde su pantalla."
              tags={["Código para compartir", "Voto secreto"]}
              onClick={() => setMode("sala")}
              delay={80}
            />
          </div>
          <JoinByCode game="oculto" />
          <Steps items={STEPS} />
        </>
      ) : null}

      {mode === "local" ? <OcultoLocal themes={themes} onExit={() => setMode("menu")} /> : null}

      {mode === "sala" ? (
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Rise className="game-dark p-7 md:p-9">
            <p className="game-label">Abrir una sala</p>
            <h2 className="editorial mt-3 text-3xl leading-tight text-white">Tú eres el anfitrión</h2>
            <p className="mt-3 text-[15px] leading-7 text-white/70">Abres la sala, compartes el código y los demás entran desde su celular. Se necesitan al menos 3 jugadores.</p>
            <ul className="mt-6 grid gap-3 text-sm text-white/80">
              {["Cada uno abre su tarjeta en secreto", "Una pista por jugador en cada ronda", "Votan tocando al sospechoso desde su pantalla"].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </Rise>
          <Rise delay={80} className="game-surface p-6 md:p-8">
            <Field label="Tu nombre">
              <div className="flex items-center gap-3">
                <Avatar name={name.trim() || "?"} />
                <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="Ej. Hna. Rocío" autoComplete="nickname" className={`${field} max-w-sm`} />
              </div>
            </Field>
            <div className="mt-8">
              <OcultoSettingsForm themes={themes} value={settings} onChange={setSettings} />
            </div>
            {error ? <div className="mt-6"><Alert>{error}</Alert></div> : null}
            <div className="mt-8 border-t border-line pt-7">
              <button type="button" className={`${primary} w-full sm:w-auto`} onClick={() => void openRoom()} disabled={busy}>
                {busy ? "Abriendo…" : "Abrir sala"}
              </button>
            </div>
          </Rise>
        </div>
      ) : null}
    </GamePage>
  );
}

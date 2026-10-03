import { router } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { OcultoLocal } from "@/Components/games/oculto-local";
import { OcultoSettingsForm, type OcultoSettings } from "@/Components/games/oculto-settings";
import { Alert, Field, GameEmblem, GamePage, field, primary } from "@/Components/games/ui";
import { playerName, postJson, roomToken, type Theme } from "@/lib/games";

type Mode = "menu" | "local" | "sala";

const STEPS = [
  ["Reparte", "Cada jugador abre su tarjeta. Todos ven la palabra secreta, menos el Cristiano Oculto."],
  ["Da pistas", "Por turnos, cada uno dice una pista corta sin decir la palabra. El oculto improvisa."],
  ["Vota", "En secreto, todos votan por quien creen que no conoce la palabra."],
  ["Descubre", "Si la mayoría acierta, lo descubren. Si no, escapa y se juega otra ronda."],
];

export default function Oculto({ themes }: { themes: Theme[] }) {
  const [mode, setMode] = useState<Mode>("menu");
  const [name, setName] = useState(playerName.get());
  const [settings, setSettings] = useState<OcultoSettings>({ categories: [], impostors: 1, clue_rounds: 2, rounds: 2 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openRoom() {
    setError("");
    if (name.trim().length < 2) return setError("Escribe tu nombre para abrir la sala.");
    setBusy(true);
    const reply = await postJson<{ code: string; token: string }>("/juegos/salas", { game: "oculto", name, settings });
    setBusy(false);
    if (reply.error) return setError(reply.error);
    playerName.set(name);
    roomToken.set(reply.code, reply.token);
    router.visit(`/juegos/sala/${reply.code}`);
  }

  return (
    <GamePage
      kicker="Juegos · El Cristiano Oculto"
      title="El Cristiano Oculto"
      text={mode === "menu" ? "Todos conocen la palabra secreta menos uno. Den pistas, sospechen y voten antes de que escape." : undefined}
      back={mode === "menu" ? { href: "/juegos", label: "Juegos" } : undefined}
      aside={mode === "menu" ? <GameEmblem game="oculto" className="hidden h-24 w-24 lg:block" /> : undefined}
    >
      {mode === "menu" ? (
        <>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <Rise>
              <button type="button" onClick={() => setMode("local")} className="panel flex h-full w-full flex-col p-7 text-left transition duration-300 hover:-translate-y-1 md:p-8">
                <span className="kicker">Modo</span>
                <span className="editorial mt-3 text-3xl text-ink">Un solo celular</span>
                <span className="mt-3 text-[15px] leading-7 text-muted">Para jugar sentados juntos: el celular pasa de mano en mano para ver las tarjetas y votar en secreto.</span>
                <span className="mt-auto pt-7 text-sm font-semibold text-accent">Elegir →</span>
              </button>
            </Rise>
            <Rise delay={80}>
              <button type="button" onClick={() => setMode("sala")} className="panel flex h-full w-full flex-col p-7 text-left transition duration-300 hover:-translate-y-1 md:p-8">
                <span className="kicker">Modo</span>
                <span className="editorial mt-3 text-3xl text-ink">Sala en vivo</span>
                <span className="mt-3 text-[15px] leading-7 text-muted">Cada uno con su celular: abres una sala, compartes el código y todos ven su tarjeta y votan desde su pantalla.</span>
                <span className="mt-auto pt-7 text-sm font-semibold text-accent">Elegir →</span>
              </button>
            </Rise>
          </div>
          <Rise className="mt-16">
            <p className="kicker">Cómo se juega</p>
            <ol className="mt-6 grid gap-4 md:grid-cols-4">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="rounded-[1.4rem] border border-line bg-card p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{index + 1}</span>
                  <p className="mt-4 font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </Rise>
        </>
      ) : null}

      {mode === "local" ? <OcultoLocal themes={themes} onExit={() => setMode("menu")} /> : null}

      {mode === "sala" ? (
        <Rise className="panel mt-12 p-6 md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="editorial text-3xl text-ink">Abrir una sala</h2>
            <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={() => setMode("menu")}>← Volver</button>
          </div>
          <div className="mt-8 grid gap-8">
            <Field label="Tu nombre" hint="Compartes el código y los demás entran desde su celular. Se necesitan al menos 3 jugadores.">
              <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="Ej. Hna. Rocío" className={`${field} max-w-sm`} />
            </Field>
            <OcultoSettingsForm themes={themes} value={settings} onChange={setSettings} />
            {error ? <Alert>{error}</Alert> : null}
            <div>
              <button type="button" className={primary} onClick={() => void openRoom()} disabled={busy}>{busy ? "Abriendo…" : "Abrir sala"}</button>
            </div>
          </div>
        </Rise>
      ) : null}
    </GamePage>
  );
}

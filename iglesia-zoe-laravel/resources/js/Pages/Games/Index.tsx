import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { GameEmblem, GamePage, field, primary } from "@/Components/games/ui";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

type Stats = { rebet: number; lingobible: number; oculto: number };

const GAMES = [
  {
    key: "rebet" as const,
    href: "/juegos/rebet",
    name: "REBET",
    tagline: "Trivia bíblica contra el reloj",
    text: "Responde antes de que se acabe el tiempo. Mientras más rápido y más seguidas aciertes, más puntos sumas.",
    modes: ["Solo", "Por turnos en un celular", "Sala en vivo"],
    stat: (stats: Stats) => `${stats.rebet} preguntas`,
  },
  {
    key: "lingobible" as const,
    href: "/juegos/lingobible",
    name: "LINGOBIBLE",
    tagline: "Rutas cortas para conocer la Palabra",
    text: "Lecciones breves con el texto bíblico a la vista. Avanza ruta por ruta, gana estrellas y desbloquea la siguiente lección.",
    modes: ["Rutas temáticas", "Estrellas y XP", "Tu avance queda en tu celular"],
    stat: (stats: Stats) => `${stats.lingobible} lecciones`,
  },
  {
    key: "oculto" as const,
    href: "/juegos/el-cristiano-oculto",
    name: "El Cristiano Oculto",
    tagline: "Pistas, sospechas y una palabra secreta",
    text: "Todos conocen la palabra menos uno. Den pistas sin decirla, descubran quién no la sabe y voten antes de que escape.",
    modes: ["Un solo celular", "Sala en vivo", "De 3 a 15 jugadores"],
    stat: (stats: Stats) => `${stats.oculto} palabras`,
  },
];

export default function GamesIndex({ stats }: { stats: Stats }) {
  const pages = useSitePages();
  const [code, setCode] = useState("");

  function enter(event: React.FormEvent) {
    event.preventDefault();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length >= 3) router.visit(`/juegos/sala/${clean}`);
  }

  return (
    <GamePage
      kicker={pages.kicker("games") || "Recursos · Juegos"}
      title={pages.name("games") || "Juegos"}
      text="Aprende la Biblia jugando, solo, en familia o con toda tu célula. Sin descargar nada y sin crear una cuenta."
    >
      <section {...section("list", "Juegos")} className="mt-16 grid gap-6 lg:grid-cols-3">
        {GAMES.map((game, index) => (
          <Rise key={game.key} delay={index * 90}>
            <Link href={game.href} className="panel group flex h-full flex-col p-7 transition duration-300 hover:-translate-y-1 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <GameEmblem game={game.key} className="h-14 w-14" />
                <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold text-ink">{game.stat(stats)}</span>
              </div>
              <p className="kicker mt-7">{game.tagline}</p>
              <h2 className="editorial mt-3 text-4xl leading-[1.02] text-ink">{game.name}</h2>
              <p className="mt-4 text-[15px] leading-7 text-muted">{game.text}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {game.modes.map((mode) => (
                  <li key={mode} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">{mode}</li>
                ))}
              </ul>
              <span className="mt-auto pt-8">
                <span className="btn-accent inline-flex rounded-full px-6 py-3 text-sm font-semibold">Jugar →</span>
              </span>
            </Link>
          </Rise>
        ))}
      </section>

      <Rise {...section("rooms", "Salas en vivo")} className="panel mt-16 grid gap-8 p-7 md:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="kicker">Salas en vivo</p>
          <h2 className="editorial mt-3 text-3xl leading-tight text-ink md:text-4xl">¿Te pasaron un código?</h2>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-muted">
            En REBET y El Cristiano Oculto alguien abre una sala y cada uno entra desde su celular con el código que aparece en su pantalla.
          </p>
        </div>
        <form onSubmit={enter} className="flex flex-col gap-3 sm:flex-row">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Ej. LUZ482"
            aria-label="Código de la sala"
            maxLength={12}
            autoCapitalize="characters"
            className={`${field} text-center text-lg font-semibold uppercase tracking-[0.3em] sm:text-left`}
          />
          <button className={primary} disabled={code.trim().length < 3}>Entrar</button>
        </form>
      </Rise>
    </GamePage>
  );
}

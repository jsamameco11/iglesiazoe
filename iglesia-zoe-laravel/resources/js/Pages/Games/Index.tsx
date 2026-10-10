import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { ArrowRight, GameEmblem, GamePage } from "@/Components/games/ui";
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
    modes: ["Solo", "Por turnos", "Sala en vivo"],
    stat: (stats: Stats) => `${stats.rebet.toLocaleString("es-PE")} preguntas`,
  },
  {
    key: "lingobible" as const,
    href: "/juegos/lingobible",
    name: "LINGOBIBLE",
    tagline: "Rutas cortas para conocer la Palabra",
    text: "Lecciones breves con el texto bíblico a la vista. Avanza ruta por ruta, gana estrellas y desbloquea la siguiente lección.",
    modes: ["Rutas temáticas", "Estrellas y XP", "Avance guardado"],
    stat: (stats: Stats) => `${stats.lingobible.toLocaleString("es-PE")} lecciones`,
  },
  {
    key: "oculto" as const,
    href: "/juegos/el-cristiano-oculto",
    name: "El Cristiano Oculto",
    tagline: "Pistas, sospechas y una palabra secreta",
    text: "Todos conocen la palabra menos uno. Den pistas sin decirla, voten por quien sospechan y descubran al cristiano oculto.",
    modes: ["Un celular", "Sala en vivo", "Intermedio y difícil"],
    stat: (stats: Stats) => `${stats.oculto.toLocaleString("es-PE")} palabras`,
  },
];

export default function GamesIndex({ stats }: { stats: Stats }) {
  const pages = useSitePages();

  return (
    <GamePage
      kicker={pages.kicker("games") || "Recursos · Juegos"}
      title={pages.name("games") || "Juegos"}
      text="Aprende la Biblia jugando, solo, en familia o con toda tu célula. Sin descargar nada y sin crear una cuenta."
    >
      <section {...section("list", "Juegos")} className="mt-14 grid gap-5 md:mt-16 lg:grid-cols-3 lg:gap-6">
        {GAMES.map((game, index) => (
          <Rise key={game.key} delay={index * 90} className="h-full">
            <Link href={game.href} className="game-surface game-lift group flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-line bg-[radial-gradient(110%_140%_at_0%_0%,var(--accent-soft)_0%,transparent_60%)] bg-sage/40 px-7 py-6 md:px-8">
                <GameEmblem game={game.key} className="h-14 w-14 transition duration-300 group-hover:scale-105" />
                <span className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold tabular-nums text-ink">{game.stat(stats)}</span>
              </div>
              <div className="flex flex-1 flex-col px-7 pb-7 pt-6 md:px-8 md:pb-8">
                <p className="game-label">{game.tagline}</p>
                <h2 className="editorial mt-3 text-[2.1rem] leading-[1.02] text-ink md:text-4xl">{game.name}</h2>
                <p className="mt-4 text-[15px] leading-7 text-muted">{game.text}</p>
                <ul className="mt-6 flex flex-wrap gap-1.5">
                  {game.modes.map((mode) => (
                    <li key={mode} className="rounded-full bg-sage/80 px-2.5 py-1 text-xs font-medium text-ink/80">
                      {mode}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto flex items-center justify-between pt-8">
                  <span className="text-[15px] font-semibold text-ink">Jugar ahora</span>
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                    <ArrowRight />
                  </span>
                </span>
              </div>
            </Link>
          </Rise>
        ))}
      </section>

      <Rise {...section("rooms", "Salas en vivo")} className="mt-14 grid gap-4 rounded-[1.6rem] border border-line bg-card/60 p-6 sm:grid-cols-[auto_1fr] sm:items-center md:p-7">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
            <path d="M7.5 10.5h2M11 10.5h2M14.5 10.5h2M8 14h8" />
          </svg>
        </span>
        <p className="text-[15px] leading-7 text-muted">
          <span className="font-semibold text-ink">¿Te pasaron un código?</span> Entra al juego de la sala (REBET o El Cristiano Oculto) y escríbelo en “¿Te pasaron un código?”. Cada código abre solo una sala de su propio juego.
        </p>
      </Rise>
    </GamePage>
  );
}

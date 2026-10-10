import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { ArrowRight, GameEmblem, GamePage, Meter, Steps, field } from "@/Components/games/ui";
import { lingoProgress } from "@/lib/games";
import { fold } from "@/lib/text";

type PathCard = { id: string; slug: string; title: string; description: string | null; units: number; lessons: string[] };

const STEPS: [string, string][] = [
  ["Elige una ruta", "Cada ruta reúne lecciones cortas sobre un tema de la Biblia."],
  ["Lee el pasaje", "Cada pregunta trae el texto bíblico a la vista para responder con la Palabra."],
  ["Aprueba con 70%", "Ganas estrellas y XP, y se abre la siguiente lección."],
];

export default function Lingobible({ paths }: { paths: PathCard[] }) {
  const [progress] = useState(lingoProgress.all);
  const [needle, setNeedle] = useState("");
  const xp = Object.values(progress).reduce((sum, item) => sum + item.xp, 0);
  const done = Object.values(progress).filter(lingoProgress.passed).length;
  const stars = Object.values(progress).reduce((sum, item) => sum + item.stars, 0);
  const complete = paths.filter((path) => path.lessons.length && path.lessons.every((id) => lingoProgress.passed(progress[id]))).length;
  const shown = useMemo(() => {
    const term = fold(needle.trim());
    return term ? paths.filter((path) => fold(`${path.title} ${path.description ?? ""}`).includes(term)) : paths;
  }, [paths, needle]);

  return (
    <GamePage
      kicker="Juegos · LINGOBIBLE"
      title="LINGOBIBLE"
      text="Rutas cortas para conocer la Palabra. Lee el pasaje, responde y avanza lección por lección."
      back={{ href: "/juegos", label: "Juegos" }}
      aside={<GameEmblem game="lingobible" className="hidden h-24 w-24 lg:block" />}
    >
      <Rise className="game-dark mt-12 grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center md:p-8">
        <div>
          <p className="game-label">Tu avance</p>
          <p className="mt-2 text-sm text-white/60">Se guarda en este celular.</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["XP", xp.toLocaleString("es-PE")],
            ["Lecciones", done],
            ["Estrellas", stars],
            ["Rutas completas", `${complete}/${paths.length}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </Rise>

      <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="game-label">{paths.length} rutas</p>
          <h2 className="editorial mt-2 text-3xl text-ink md:text-4xl">Elige una ruta</h2>
        </div>
        <input type="search" value={needle} onChange={(event) => setNeedle(event.target.value)} placeholder="Buscar ruta…" aria-label="Buscar ruta" className={`${field} max-w-xs py-2.5 text-sm`} />
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((path, index) => {
          const passed = path.lessons.filter((id) => lingoProgress.passed(progress[id])).length;
          const finished = path.lessons.length > 0 && passed === path.lessons.length;
          return (
            <Rise key={path.id} delay={(index % 3) * 70} className="h-full">
              <Link href={`/juegos/lingobible/${path.slug}`} className="game-surface game-lift group flex h-full flex-col p-6 md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <p className="game-label">
                    {path.units} {path.units === 1 ? "unidad" : "unidades"} · {path.lessons.length} lecciones
                  </p>
                  {finished ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Completa</span> : null}
                </div>
                <h3 className="editorial mt-4 text-[1.9rem] leading-[1.05] text-ink">{path.title}</h3>
                {path.description ? <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-muted">{path.description}</p> : null}
                <div className="mt-auto pt-7">
                  <Meter value={passed} total={path.lessons.length} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted">{finished ? "Ruta completa" : passed ? `${passed} de ${path.lessons.length} completadas` : "Sin empezar"}</p>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink transition group-hover:text-accent">
                      {finished ? "Repasar" : passed ? "Continuar" : "Empezar"} <ArrowRight />
                    </span>
                  </div>
                </div>
              </Link>
            </Rise>
          );
        })}
      </div>
      {!shown.length ? <p className="mt-8 text-muted">No encontramos rutas con ese nombre.</p> : null}
      <Steps items={STEPS} />
    </GamePage>
  );
}

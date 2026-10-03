import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { GameEmblem, GamePage, Meter, field } from "@/Components/games/ui";
import { lingoProgress } from "@/lib/games";
import { fold } from "@/lib/text";

type PathCard = { id: string; slug: string; title: string; description: string | null; units: number; lessons: string[] };

export default function Lingobible({ paths }: { paths: PathCard[] }) {
  const [progress] = useState(lingoProgress.all);
  const [needle, setNeedle] = useState("");
  const xp = Object.values(progress).reduce((sum, item) => sum + item.xp, 0);
  const done = Object.values(progress).filter(lingoProgress.passed).length;
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
      aside={
        <div className="flex items-center gap-4 rounded-[1.4rem] border border-line bg-card px-5 py-4">
          <GameEmblem game="lingobible" className="h-12 w-12" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Tu avance</p>
            <p className="text-lg font-semibold text-ink">
              {xp} XP · {done} {done === 1 ? "lección" : "lecciones"}
            </p>
          </div>
        </div>
      }
    >
      <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
        <h2 className="editorial text-3xl text-ink md:text-4xl">Elige una ruta</h2>
        <input type="search" value={needle} onChange={(event) => setNeedle(event.target.value)} placeholder="Buscar ruta…" className={`${field} max-w-xs py-2.5 text-sm`} />
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((path, index) => {
          const passed = path.lessons.filter((id) => lingoProgress.passed(progress[id])).length;
          return (
            <Rise key={path.id} delay={(index % 3) * 70}>
              <Link href={`/juegos/lingobible/${path.slug}`} className="panel flex h-full flex-col p-6 transition duration-300 hover:-translate-y-1 md:p-7">
                <p className="kicker">
                  {path.units} {path.units === 1 ? "unidad" : "unidades"} · {path.lessons.length} lecciones
                </p>
                <h3 className="editorial mt-3 text-[1.9rem] leading-[1.05] text-ink">{path.title}</h3>
                {path.description ? <p className="mt-3 text-[15px] leading-7 text-muted">{path.description}</p> : null}
                <div className="mt-auto pt-7">
                  <Meter value={passed} total={path.lessons.length} />
                  <p className="mt-2 text-xs font-medium text-muted">
                    {passed === path.lessons.length ? "Ruta completa ✓" : passed ? `${passed} de ${path.lessons.length} completadas` : "Sin empezar"}
                  </p>
                </div>
              </Link>
            </Rise>
          );
        })}
      </div>
      {!shown.length ? <p className="mt-8 text-muted">No encontramos rutas con ese nombre.</p> : null}
    </GamePage>
  );
}

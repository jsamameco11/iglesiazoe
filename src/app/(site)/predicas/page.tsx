import type { Metadata } from "next";
import { getSermons, getSettings } from "@/lib/content";

export const metadata: Metadata = { title: "Prédicas" };

export default async function SermonsPage() {
  const [settings, sermons] = await Promise.all([getSettings(), getSermons()]);
  const live = sermons.find((sermon) => sermon.is_live) || null;
  const liveId = settings.liveYoutubeId || live?.youtube_id;
  const archive = sermons.filter((sermon) => sermon.id !== live?.id);
  const series = [...new Set(archive.map((sermon) => sermon.series || "Mensajes"))];

  return (
    <article className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">Prédicas</p>
      <h1 className="display mt-3 text-5xl md:text-6xl">En vivo y mensajes</h1>
      <div className="mt-10 overflow-hidden rounded-[1.75rem] bg-ink">
        {liveId ? (
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${liveId}`}
            title="Transmisión"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex aspect-video items-end bg-[url('/images/banner4.jpg')] bg-cover bg-center p-8">
            <div className="rounded-2xl bg-black/55 px-5 py-4 text-white backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em]">Domingo</p>
              <p className="mt-1 text-2xl font-light">La transmisión se publica aquí cada servicio.</p>
            </div>
          </div>
        )}
      </div>

      <h2 className="display mt-16 text-4xl">Biblioteca</h2>
      {archive.length === 0 ? (
        <p className="mt-4 text-muted">Los mensajes anteriores aparecerán aquí, organizados por serie.</p>
      ) : (
        series.map((name) => (
          <section key={name} className="mt-8">
            <h3 className="text-sm uppercase tracking-[0.18em] text-muted">{name}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {archive.filter((sermon) => (sermon.series || "Mensajes") === name).map((sermon) => (
                <a
                  key={sermon.id}
                  href={sermon.youtube_id ? `https://www.youtube.com/watch?v=${sermon.youtube_id}` : "#predicas"}
                  className="rounded-[1.5rem] border border-line bg-card p-5"
                  target={sermon.youtube_id ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <p className="text-xs text-muted">{sermon.sermon_date}</p>
                  <p className="mt-2 text-xl font-light">{sermon.title}</p>
                  <p className="mt-2 text-sm text-muted">{sermon.preacher}</p>
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </article>
  );
}

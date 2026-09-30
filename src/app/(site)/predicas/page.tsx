import type { Metadata } from "next";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { getSermons, getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Prédicas" };

export default async function SermonsPage() {
  const [settings, sermons, media] = await Promise.all([getSettings(), getSermons(), getSiteMedia()]);
  const live = sermons.find((sermon) => sermon.is_live) || null;
  const liveId = settings.liveYoutubeId || live?.youtube_id;
  const archive = sermons.filter((sermon) => sermon.id !== live?.id);
  const series = [...new Set(archive.map((sermon) => sermon.series || "Mensajes"))];

  return (
    <article className="page-wrap">
      <Rise>
        <p className="kicker">Prédicas</p>
        <LeadTitle lead="En vivo" accent="y mensajes" className="mt-4 text-5xl md:text-7xl" />
      </Rise>
      <Rise delay={100}>
      <div className="shot relative mt-12 aspect-video">
        {liveId ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${liveId}`}
            title="Transmisión"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0">
            <MediaView asset={media.sermons} fit="cover" />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/15 to-black/25 p-8 md:p-14">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">Domingo</p>
                <p className="display mt-3 max-w-xl text-4xl text-white">La transmisión se publica aquí cada servicio.</p>
              </div>
            </div>
          </div>
        )}
      </div>
      </Rise>

      <Rise>
        <LeadTitle as="h2" lead="Biblioteca" className="mt-24 text-4xl md:text-5xl" />
      </Rise>
      {archive.length === 0 ? (
        <p className="mt-6 text-muted">Los mensajes anteriores aparecerán aquí, organizados por serie.</p>
      ) : (
        series.map((name, index) => (
          <Rise key={name} delay={index * 80}>
          <section className="mt-12">
            <h3 className="text-[11px] uppercase tracking-[0.22em] text-muted">{name}</h3>
            <div className="mt-6 divide-y divide-ink/10">
              {archive.filter((sermon) => (sermon.series || "Mensajes") === name).map((sermon) => (
                <a
                  key={sermon.id}
                  href={sermon.youtube_id ? `https://www.youtube.com/watch?v=${sermon.youtube_id}` : "#predicas"}
                  className="grid gap-2 py-6 md:grid-cols-[140px_1fr_180px] md:items-baseline"
                  target={sermon.youtube_id ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <p className="text-sm text-muted">{sermon.sermon_date}</p>
                  <p className="text-2xl font-light">{sermon.title}</p>
                  <p className="text-sm text-muted md:text-right">{sermon.preacher}</p>
                </a>
              ))}
            </div>
          </section>
          </Rise>
        ))
      )}
    </article>
  );
}

import type { Metadata } from "next";
import { BaptismForm } from "@/components/site/forms";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getBaptismEvents } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Bautismos" };

export default async function BaptismPage() {
  const [events, media] = await Promise.all([getBaptismEvents(), getSiteMedia()]);
  const next = events[0];
  const dateLabel = next?.event_date
    ? new Date(next.event_date + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : "Fecha por confirmar";

  return (
    <article className="page-wrap">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <p className="kicker">Bautismos</p>
          <LeadTitle lead="Tu nuevo" accent="comienzo" className="mt-4 text-5xl md:text-7xl" />
          <p className="ital mt-5 text-2xl text-muted">Da el siguiente paso en tu fe.</p>
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">
            Creemos que el bautismo en agua es una declaración pública de tu fe en Jesucristo. Es el símbolo de dejar atrás la vieja manera de vivir y nacer a una nueva vida en Él. Si has tomado la decisión de seguir a Jesús, este es el siguiente paso más importante que puedes dar.
          </p>
          <dl className="mt-12 grid gap-8 sm:grid-cols-2">
            <div>
              <dt className="kicker">Próxima fecha</dt>
              <dd className="display mt-3 text-3xl">{dateLabel}</dd>
            </div>
            <div>
              <dt className="kicker">Requisito</dt>
              <dd className="mt-3 text-lg font-light leading-7">Asistir a la charla informativa previa.</dd>
            </div>
          </dl>
        </Rise>
        <Rise delay={120}>
          <PageBand asset={media.baptism} ratio="aspect-[16/10] lg:aspect-[4/5]" />
        </Rise>
      </div>
      <Rise delay={80}>
        <div className="panel mt-16 max-w-3xl p-7 md:p-10">
          <BaptismForm events={events} />
        </div>
      </Rise>
    </article>
  );
}

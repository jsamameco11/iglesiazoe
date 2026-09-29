import type { Metadata } from "next";
import { BaptismForm } from "@/components/site/forms";
import { getBaptismEvents } from "@/lib/content";

export const metadata: Metadata = { title: "Bautismos" };

export default async function BaptismPage() {
  const events = await getBaptismEvents();
  const next = events[0];
  const dateLabel = next?.event_date
    ? new Date(next.event_date + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : "Fecha por confirmar";

  return (
    <article className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-20 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Bautismos</p>
        <h1 className="display mt-3 text-5xl md:text-6xl">Tu nuevo comienzo</h1>
        <p className="mt-4 text-xl font-light text-muted">Da el siguiente paso en tu fe.</p>
        <p className="mt-6 leading-8">
          Creemos que el bautismo en agua es una declaración pública de tu fe en Jesucristo. Es el símbolo de dejar atrás la vieja manera de vivir y nacer a una nueva vida en Él. Si has tomado la decisión de seguir a Jesús, ¡este es el siguiente paso más importante que puedes dar!
        </p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-5">
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">Próxima fecha</dt>
            <dd className="mt-2 text-lg">{dateLabel}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">Requisito</dt>
            <dd className="mt-2 text-lg">Asistir a nuestra charla informativa previa.</dd>
          </div>
        </dl>
      </div>
      <BaptismForm events={events} />
    </article>
  );
}

import type { Metadata } from "next";
import { VisitForm } from "@/components/site/forms";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Planifica tu visita" };

export default async function VisitPage() {
  const media = await getSiteMedia();
  return (
    <article className="page-wrap">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <p className="kicker">Primera vez</p>
          <LeadTitle lead="Planifica" accent="tu visita" className="mt-4 text-5xl md:text-7xl" />
          <p className="mt-6 max-w-md text-lg font-light leading-8 text-muted">
            Nos encantaría recibirte. Llena este formulario y un equipo de bienvenida estará atento para acompañarte.
          </p>
        </Rise>
        <Rise delay={120}>
          <MediaView asset={media.visit} />
        </Rise>
      </div>
      <Rise delay={80}>
        <div className="panel mt-16 max-w-3xl p-7 md:p-10">
          <VisitForm />
        </div>
      </Rise>
    </article>
  );
}

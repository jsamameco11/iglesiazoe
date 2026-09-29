import type { Metadata } from "next";
import { VisitForm } from "@/components/site/forms";

export const metadata: Metadata = { title: "Planifica tu visita" };

export default function VisitPage() {
  return (
    <article className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Primera vez</p>
        <h1 className="display mt-3 text-5xl md:text-6xl">Planifica tu visita</h1>
        <p className="mt-6 text-lg leading-8 text-muted">
          Nos encantaría recibirte. Llena este formulario y un equipo de bienvenida estará atento para acompañarte.
        </p>
        <img src="/images/familia1.jpg" alt="Familia de la iglesia" className="mt-10 h-72 w-full rounded-[1.75rem] object-cover" />
      </div>
      <VisitForm />
    </article>
  );
}

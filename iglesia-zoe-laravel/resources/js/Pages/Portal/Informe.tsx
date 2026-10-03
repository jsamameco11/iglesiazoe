import { Link } from "@inertiajs/react";
import { InformeForm } from "@/Components/portal/informe-form";
import PortalLayout from "@/Layouts/PortalLayout";
import type { Cell } from "@/lib/types";

export default function Informe({ cells, year, week, canOpenOwnCell }: { cells: Cell[]; year: number; week: number; canOpenOwnCell: boolean }) {
  return (
    <PortalLayout>
      <h1 className="display text-4xl">Informe semanal</h1>
      <p className="mt-2 text-muted">Elige la célula y la semana. El informe queda guardado para tu historial y el seguimiento de la red.</p>
      {cells.length === 0 ? (
        canOpenOwnCell ? (
          <div className="mt-8 rounded-2xl border border-line bg-card p-6">
            <p className="font-semibold">Todavía no tienes una célula propia.</p>
            <p className="mt-1 text-sm text-muted">Si lideras una célula, ábrela tú mismo en Servidores y aquí podrás subir su informe cada semana.</p>
            <Link href="/admin/servidores" className="mt-4 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Abrir mi célula</Link>
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-line bg-card p-6">Tu usuario todavía no tiene una célula asignada. Pídele al administrador que te la asigne.</p>
        )
      ) : (
        <div className="mt-6"><InformeForm cells={cells} year={year} week={week} /></div>
      )}
    </PortalLayout>
  );
}

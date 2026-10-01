import { InformeForm } from "@/Components/portal/informe-form";
import PortalLayout from "@/Layouts/PortalLayout";
import type { Cell } from "@/lib/types";

export default function Informe({ cells, year, week }: { cells: Cell[]; year: number; week: number }) {
  return (
    <PortalLayout>
      <h1 className="display text-4xl">Informe semanal</h1>
      <p className="mt-2 text-muted">Elige la célula y la semana. El informe queda guardado para tu historial y el seguimiento de la red.</p>
      {cells.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-card p-6">Tu usuario todavía no tiene una célula asignada. Pídele al administrador que te la asigne.</p>
      ) : (
        <div className="mt-6"><InformeForm cells={cells} year={year} week={week} /></div>
      )}
    </PortalLayout>
  );
}

import { Link, router } from "@inertiajs/react";
import PortalLayout from "@/Layouts/PortalLayout";
import { FormEvent } from "react";
import { CellCode } from "@/Components/ui/cell-code";

type Row = {
  id: string;
  code: string | null;
  met: boolean;
  theme_title: string | null;
  meeting_date: string | null;
  year: number;
  week: number;
  attended: number;
};

export default function Historial({
  rows,
  ownCells,
  filters,
}: {
  rows: Row[];
  ownCells: { id: string; code: string }[];
  filters: { year: string; month: string; cell: string };
}) {
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    router.get("/portal/historial", Object.fromEntries(data.entries()));
  }

  return (
    <PortalLayout>
      <h1 className="display text-4xl">Historial de informe semanal</h1>
      <p className="mt-2 text-muted">Aquí ves los informes de tus propias células.</p>
      <form onSubmit={search} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-4">
        <label className="text-sm">Año<input name="year" defaultValue={filters.year} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
        <label className="text-sm">Mes
          <select name="month" defaultValue={filters.month} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            <option value="">Todos</option>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{index + 1}</option>)}
          </select>
        </label>
        <label className="text-sm">Célula
          <select name="cell" defaultValue={filters.cell} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            <option value="">Todas las mías</option>
            {ownCells.map((cell) => <option key={cell.id} value={cell.id}>{cell.code}</option>)}
          </select>
        </label>
        <button className="self-end rounded-full bg-ink px-5 py-2.5 text-sm text-white">Buscar</button>
      </form>
      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="bg-orange text-left text-white"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Célula</th><th className="px-4 py-3">Tema</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Participantes</th><th className="px-4 py-3">Ver</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3"><CellCode code={row.code} /></td>
                <td className="px-4 py-3">{row.met ? row.theme_title || "Reunión" : "No se reunió"}</td>
                <td className="px-4 py-3">{row.meeting_date || `${row.year} · semana ${row.week}`}</td>
                <td className="px-4 py-3">{row.attended}</td>
                <td className="px-4 py-3"><Link href="/portal/informe" className="text-orange-deep">Abrir</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-muted">Todavía no hay informes en este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  );
}

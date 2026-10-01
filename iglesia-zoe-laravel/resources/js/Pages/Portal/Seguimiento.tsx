import { router } from "@inertiajs/react";
import PortalLayout from "@/Layouts/PortalLayout";
import { FormEvent } from "react";

type Network = { id: string; code: string; name: string };
type Row = {
  id: string;
  code: string;
  parent_id: string | null;
  leader_name: string | null;
  attendance: number;
  salvations: number;
  families: number;
  status: string;
};

export default function Seguimiento({
  networks,
  network,
  rows,
  totals,
  filters,
  staff,
  weeks,
}: {
  networks: Network[];
  network: Network | null;
  rows: Row[];
  totals: { attendance: number; salvations: number; families: number; reports: number };
  filters: { year: number; week: number };
  staff: boolean;
  weeks: { week: number; label: string }[];
}) {
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    router.get("/portal/seguimiento", Object.fromEntries(data.entries()));
  }

  return (
    <PortalLayout>
      <h1 className="display text-4xl">Seguimiento</h1>
      <p className="mt-2 text-muted">Registro de seguimiento de grupos celulares{network ? ` (RED ${network.code})` : ""}.</p>
      <form onSubmit={search} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-4">
        <label className="text-sm">Año<input name="year" defaultValue={filters.year} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
        <label className="text-sm md:col-span-2">Semana
          <select name="week" defaultValue={filters.week} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            {weeks.map((item) => <option key={item.week} value={item.week}>{item.label}</option>)}
          </select>
        </label>
        {staff && (
          <label className="text-sm">Red
            <select name="red" defaultValue={network?.code} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
              {networks.map((item) => <option key={item.id}>{item.code}</option>)}
            </select>
          </label>
        )}
        <button className="rounded-full bg-ink px-5 py-2.5 text-sm text-white md:col-span-4 md:w-fit">Buscar</button>
      </form>
      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="bg-orange text-left text-white">
            <tr>
              <th className="px-4 py-3">#</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Líder</th><th className="px-4 py-3">Asistencia</th><th className="px-4 py-3">N. creyente</th><th className="px-4 py-3">Cant. familia</th><th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cell, index) => (
              <tr key={cell.id} className="border-t border-line">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3" style={{ paddingLeft: cell.parent_id ? 28 : 16 }}>{cell.code}</td>
                <td className="px-4 py-3">{cell.leader_name || "—"}</td>
                <td className="px-4 py-3">{cell.attendance}</td>
                <td className="px-4 py-3">{cell.salvations}</td>
                <td className="px-4 py-3">{cell.families}</td>
                <td className="px-4 py-3">{cell.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-medium">
              <td className="px-4 py-3" colSpan={3}>Total · informes enviados: {totals.reports}</td>
              <td className="px-4 py-3">{totals.attendance}</td>
              <td className="px-4 py-3">{totals.salvations}</td>
              <td className="px-4 py-3">{totals.families}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </PortalLayout>
  );
}

import { getSession } from "@/lib/session";
import { currentWeek, weeksOfYear } from "@/lib/weeks";
import type { Cell } from "@/lib/types";

export default async function SeguimientoPage({ searchParams }: { searchParams: Promise<{ year?: string; week?: string; red?: string }> }) {
  const params = await searchParams;
  const { supabase, profile } = await getSession();
  const now = currentWeek();
  const year = Number(params.year || now.year);
  const week = Number(params.week || now.week);
  const { data: networks } = await supabase.from("networks").select("id, code, name").order("code");
  const network = profile?.role === "admin"
    ? networks?.find((item) => item.code === (params.red || "G")) || networks?.[0]
    : networks?.find((item) => item.id === profile?.network_id);

  const { data: cells } = network
    ? await supabase.from("cells").select("*").eq("network_id", network.id).eq("active", true).order("code")
    : { data: [] };
  const ids = (cells || []).map((cell) => cell.id);
  const { data: reports } = ids.length
    ? await supabase.from("reports").select("cell_id, met, salvations, families, report_attendance(attended)").eq("year", year).eq("week", week).in("cell_id", ids)
    : { data: [] };

  const byCell = new Map((reports || []).map((report) => [report.cell_id, report]));
  const ordered = orderCells((cells || []) as Cell[]);
  const totals = ordered.reduce((acc, cell) => {
    const report = byCell.get(cell.id);
    acc.attendance += ((report?.report_attendance as { attended: boolean }[]) || []).filter((row) => row.attended).length;
    acc.salvations += Number(report?.salvations || 0);
    acc.families += Number(report?.families || 0);
    acc.reports += report ? 1 : 0;
    return acc;
  }, { attendance: 0, salvations: 0, families: 0, reports: 0 });

  return (
    <div>
      <h1 className="display text-4xl">Seguimiento</h1>
      <p className="mt-2 text-muted">Registro de seguimiento de grupos celulares{network ? ` (RED ${network.code})` : ""}.</p>
      <form className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-4">
        <label className="text-sm">Año<input name="year" defaultValue={year} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
        <label className="text-sm md:col-span-2">Semana
          <select name="week" defaultValue={week} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            {weeksOfYear(year).map((item) => <option key={item.week} value={item.week}>{item.label}</option>)}
          </select>
        </label>
        {profile?.role === "admin" && (
          <label className="text-sm">Red
            <select name="red" defaultValue={network?.code} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
              {(networks || []).map((item) => <option key={item.id}>{item.code}</option>)}
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
            {ordered.map((cell, index) => {
              const report = byCell.get(cell.id);
              const attendance = ((report?.report_attendance as { attended: boolean }[]) || []).filter((row) => row.attended).length;
              return (
                <tr key={cell.id} className="border-t border-line">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3" style={{ paddingLeft: cell.parent_id ? 28 : 16 }}>{cell.code}</td>
                  <td className="px-4 py-3">{cell.leader_name || "—"}</td>
                  <td className="px-4 py-3">{attendance}</td>
                  <td className="px-4 py-3">{report?.salvations || 0}</td>
                  <td className="px-4 py-3">{report?.families || 0}</td>
                  <td className="px-4 py-3">{report ? (report.met ? "Se reunió" : "No se reunió") : "Sin informe"}</td>
                </tr>
              );
            })}
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
    </div>
  );
}

function orderCells(cells: Cell[]) {
  const roots = cells.filter((cell) => !cell.parent_id).sort((a, b) => a.number - b.number || a.code.localeCompare(b.code));
  const result: Cell[] = [];
  for (const root of roots) {
    result.push(root);
    result.push(...cells.filter((cell) => cell.parent_id === root.id).sort((a, b) => a.number - b.number));
  }
  return result;
}

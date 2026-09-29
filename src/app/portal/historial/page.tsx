import Link from "next/link";
import { getSession } from "@/lib/session";

export default async function HistorialPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; cell?: string }> }) {
  const params = await searchParams;
  const { supabase, profile } = await getSession();
  const { data: links } = await supabase.from("user_cells").select("cell_id, cells(code)").eq("user_id", profile!.id);
  const ownCells = (links || []).map((row) => ({
    id: row.cell_id as string,
    code: (row.cells as { code?: string } | null)?.code || "",
  }));
  const cellIds = profile?.role === "admin" ? null : ownCells.map((cell) => cell.id);
  let query = supabase.from("reports").select("id, year, week, meeting_date, theme_title, met, cell_id, cells(code), report_attendance(attended)").order("year", { ascending: false }).order("week", { ascending: false });
  if (cellIds) query = query.in("cell_id", cellIds.length ? cellIds : ["00000000-0000-0000-0000-000000000000"]);
  if (params.year) query = query.eq("year", Number(params.year));
  if (params.cell) query = query.eq("cell_id", params.cell);
  const { data } = await query.limit(200);
  const rows = (data || []).filter((row) => {
    if (!params.month) return true;
    return String(row.meeting_date || "").slice(5, 7) === params.month;
  });

  return (
    <div>
      <h1 className="display text-4xl">Historial de informe semanal</h1>
      <p className="mt-2 text-muted">Aquí ves los informes de tus propias células.</p>
      <form className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-4">
        <label className="text-sm">Año<input name="year" defaultValue={params.year || String(new Date().getFullYear())} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
        <label className="text-sm">Mes
          <select name="month" defaultValue={params.month || ""} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            <option value="">Todos</option>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={String(index + 1).padStart(2, "0")}>{index + 1}</option>)}
          </select>
        </label>
        <label className="text-sm">Célula
          <select name="cell" defaultValue={params.cell || ""} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
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
            {rows.map((row, index) => {
              const attended = ((row.report_attendance as { attended: boolean }[]) || []).filter((item) => item.attended).length;
              const code = (row.cells as { code?: string } | null)?.code;
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">{code}</td>
                  <td className="px-4 py-3">{row.met ? row.theme_title || "Reunión" : "No se reunió"}</td>
                  <td className="px-4 py-3">{row.meeting_date || `${row.year} · semana ${row.week}`}</td>
                  <td className="px-4 py-3">{attended}</td>
                  <td className="px-4 py-3"><Link href={`/portal/informe`} className="text-orange-deep">Abrir</Link></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-muted">Todavía no hay informes en este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

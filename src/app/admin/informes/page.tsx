import { getSession } from "@/lib/session";

export default async function ReportsAdmin() {
  const { supabase } = await getSession();
  const { data } = await supabase
    .from("reports")
    .select("id, year, week, met, theme_title, offering, salvations, cells(code), report_attendance(attended)")
    .order("year", { ascending: false })
    .order("week", { ascending: false })
    .limit(150);
  return (
    <div>
      <h1 className="display text-4xl">Informes</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="text-left"><tr><th className="px-4 py-3">Célula</th><th className="px-4 py-3">Semana</th><th className="px-4 py-3">Tema</th><th className="px-4 py-3">Asistencia</th><th className="px-4 py-3">Salvos</th><th className="px-4 py-3">Ofrenda</th></tr></thead>
          <tbody>
            {(data || []).map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3">{(row.cells as { code?: string } | null)?.code}</td>
                <td className="px-4 py-3">{row.year} · {row.week}</td>
                <td className="px-4 py-3">{row.met ? row.theme_title : "No se reunió"}</td>
                <td className="px-4 py-3">{((row.report_attendance as { attended: boolean }[]) || []).filter((item) => item.attended).length}</td>
                <td className="px-4 py-3">{row.salvations}</td>
                <td className="px-4 py-3">{row.offering}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

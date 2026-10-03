import AdminLayout from "@/Layouts/AdminLayout";
import { PageHeader, Panel, PeriodFilter } from "@/Components/admin/ui";
import { CellCode } from "@/Components/ui/cell-code";
import { money } from "@/lib/access";

type Row = { code: string; network: string; leader: string | null; status: string; offering: number | null };

export default function Ofrendas({ filters, label, weeks, rows, weekTotal }: { filters: Record<string, string | number>; label: string; weeks: { week: number; label: string }[]; rows: Row[]; weekTotal: number }) {
  const networks = [...new Set(rows.map((row) => row.network))];

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Células"
          title="Ofrendas por semana"
          text="La ofrenda que cada célula registró en su informe, semana por semana."
          aside={<div className="rounded-2xl border border-line bg-white px-5 py-3 text-right"><p className="text-2xl font-semibold">{money(weekTotal)}</p><p className="text-[11px] uppercase tracking-wider text-muted">ofrenda de la semana</p></div>}
        />
        <div className="mt-6"><PeriodFilter url="/admin/ofrendas" filters={filters} weeks={weeks} modes={[{ key: "semana", label: "Semana" }]} /></div>
        <p className="mt-6 text-sm font-semibold text-muted">{label}</p>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          {networks.map((network) => {
            const list = rows.filter((row) => row.network === network);
            return (
              <Panel key={network} title={`Red ${network}`} text={`${list.filter((row) => row.offering !== null).length} de ${list.length} células con informe`}>
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((row) => (
                      <tr key={row.code} className="border-t border-line first:border-0">
                        <td className="py-2.5"><CellCode code={row.code} /></td>
                        <td className="py-2.5 text-muted">{row.leader || "—"}</td>
                        <td className="py-2.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.status === "Se reunió" ? "bg-mist text-[#3d6248]" : row.status === "No se reunió" ? "bg-blush text-[#8a4a33]" : "bg-paper text-muted"}`}>{row.status}</span></td>
                        <td className="py-2.5 text-right font-semibold">{row.offering === null ? "—" : money(row.offering)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            );
          })}
          {!rows.length && <p className="text-sm text-muted">No hay células activas.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}

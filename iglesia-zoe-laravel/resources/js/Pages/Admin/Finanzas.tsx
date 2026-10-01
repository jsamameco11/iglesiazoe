import { useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { PageHeader, Panel, PeriodFilter, Stat, ghost } from "@/Components/admin/ui";
import { money } from "@/lib/access";
import type { ExpenseRow } from "./Gastos";

type Summary = { offerings: number; tithes: number; income: number; expenses: number; balance: number; reports: number };
type Point = { label: string; offerings: number; tithes: number; expenses: number };
type IncomeRow = { id: string; date: string; year: number; week: number; cell: string; leader: string | null; network: string; met: boolean; offering: number; tithes: number };

type Props = {
  filters: Record<string, string | number>;
  label: string;
  weeks: { week: number; label: string }[];
  summary: Summary;
  series: Point[];
  byNetwork: { network: string; offerings: number; tithes: number; reports: number }[];
  byCategory: { category: string; amount: number; count: number }[];
  income: IncomeRow[];
  expenses: ExpenseRow[];
};

export default function Finanzas({ filters, label, weeks, summary, series, byNetwork, byCategory, income, expenses }: Props) {
  const [tab, setTab] = useState<"ingresos" | "gastos">("ingresos");
  const maxCategory = Math.max(1, ...byCategory.map((item) => item.amount));

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader kicker="Superadmi" title="Finanzas" text="Ofrendas y diezmos que llegan en los informes de célula, frente a los gastos registrados por Atmósfera." />
        <div className="mt-6">
          <PeriodFilter
            url="/admin/finanzas"
            filters={filters}
            weeks={weeks}
            modes={[{ key: "mes", label: "Mes" }, { key: "semana", label: "Semana" }, { key: "anio", label: "Año" }, { key: "rango", label: "Fechas" }]}
          />
        </div>
        <p className="mt-6 text-sm font-semibold text-muted">{label}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Ofrendas" value={money(summary.offerings)} note={`${summary.reports} informes`} tone="bg-mist" />
          <Stat label="Diezmos" value={money(summary.tithes)} note="Registrados por integrante" tone="bg-sky" />
          <Stat label="Ingresos totales" value={money(summary.income)} note="Ofrendas + diezmos" tone="bg-white" />
          <Stat label="Gastos" value={money(summary.expenses)} note={`${expenses.length} compras`} tone="bg-blush" />
          <Stat label="Balance" value={money(summary.balance)} note={summary.balance >= 0 ? "A favor" : "En contra"} tone={summary.balance >= 0 ? "bg-[#e3efe2]" : "bg-red-50"} />
        </div>

        <Panel className="mt-6" title="Evolución" text="Ingresos (ofrendas y diezmos) frente a gastos en el periodo.">
          <Chart series={series} />
        </Panel>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Ingresos por red">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="pb-2">Red</th><th className="pb-2">Informes</th><th className="pb-2 text-right">Ofrendas</th><th className="pb-2 text-right">Diezmos</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {byNetwork.map((row) => (
                  <tr key={row.network} className="border-t border-line">
                    <td className="py-2.5 font-semibold">Red {row.network}</td>
                    <td className="py-2.5">{row.reports}</td>
                    <td className="py-2.5 text-right">{money(row.offerings)}</td>
                    <td className="py-2.5 text-right">{money(row.tithes)}</td>
                    <td className="py-2.5 text-right font-semibold">{money(row.offerings + row.tithes)}</td>
                  </tr>
                ))}
                {!byNetwork.length && <tr><td colSpan={5} className="py-8 text-center text-muted">Sin informes en este periodo.</td></tr>}
              </tbody>
            </table>
          </Panel>
          <Panel title="Gastos por categoría">
            <div className="space-y-3">
              {byCategory.map((row) => (
                <div key={row.category}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{row.category} <span className="text-xs text-muted">· {row.count}</span></span><span className="font-semibold">{money(row.amount)}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-[#c98b6b]" style={{ width: `${(row.amount / maxCategory) * 100}%` }} /></div>
                </div>
              ))}
              {!byCategory.length && <p className="py-8 text-center text-sm text-muted">Sin gastos en este periodo.</p>}
            </div>
          </Panel>
        </div>

        <Panel
          className="mt-6"
          actions={
            <div className="flex flex-wrap gap-2">
              {(["ingresos", "gastos"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === key ? "bg-ink text-white" : "bg-paper text-muted"}`}>
                  {key === "ingresos" ? `Ingresos (${income.length})` : `Gastos (${expenses.length})`}
                </button>
              ))}
              <button type="button" onClick={() => downloadCsv(tab, income, expenses, label)} className={`${ghost} py-1.5 text-xs`}>Descargar CSV</button>
            </div>
          }
          title="Detalle"
        >
          <div className="overflow-x-auto">
            {tab === "ingresos" ? (
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="pb-2">Fecha</th><th className="pb-2">Semana</th><th className="pb-2">Célula</th><th className="pb-2">Servidor</th><th className="pb-2 text-right">Ofrenda</th><th className="pb-2 text-right">Diezmos</th></tr></thead>
                <tbody>
                  {income.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="py-2.5">{row.date.split("-").reverse().join("/")}</td>
                      <td className="py-2.5">{row.week}</td>
                      <td className="py-2.5 font-semibold">{row.cell}</td>
                      <td className="py-2.5 text-muted">{row.leader || "—"}</td>
                      <td className="py-2.5 text-right">{money(row.offering)}</td>
                      <td className="py-2.5 text-right">{money(row.tithes)}</td>
                    </tr>
                  ))}
                  {!income.length && <tr><td colSpan={6} className="py-8 text-center text-muted">Sin ingresos en este periodo.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="pb-2">Fecha</th><th className="pb-2">Detalle</th><th className="pb-2">Categoría</th><th className="pb-2">Registró</th><th className="pb-2 text-right">Monto</th><th className="pb-2 text-right">Boleta</th></tr></thead>
                <tbody>
                  {expenses.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="py-2.5">{row.spent_on.split("-").reverse().join("/")}</td>
                      <td className="max-w-xs py-2.5">{row.detail}</td>
                      <td className="py-2.5 text-muted">{row.category}</td>
                      <td className="py-2.5 text-muted">{row.by}</td>
                      <td className="py-2.5 text-right font-semibold">{money(row.amount)}</td>
                      <td className="py-2.5 text-right">{row.receipt ? <a href={row.receipt} target="_blank" rel="noreferrer" className="text-xs font-semibold text-orange-deep">Ver</a> : "—"}</td>
                    </tr>
                  ))}
                  {!expenses.length && <tr><td colSpan={6} className="py-8 text-center text-muted">Sin gastos en este periodo.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}

function Chart({ series }: { series: Point[] }) {
  const max = Math.max(1, ...series.map((point) => Math.max(point.offerings + point.tithes, point.expenses)));
  if (!series.length) return <p className="py-10 text-center text-sm text-muted">Sin datos.</p>;
  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#6f8f7a]" />Ofrendas</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#9cb7c9]" />Diezmos</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#d79b7f]" />Gastos</span>
      </div>
      <div className="mt-5 flex h-56 items-end gap-2 overflow-x-auto pb-1">
        {series.map((point) => (
          <div key={point.label} className="flex min-w-[2.6rem] flex-1 flex-col items-center gap-2" title={`${point.label}: ingresos ${money(point.offerings + point.tithes)} · gastos ${money(point.expenses)}`}>
            <div className="flex h-48 w-full items-end justify-center gap-1">
              <div className="flex w-1/2 max-w-7 flex-col justify-end overflow-hidden rounded-t-md">
                <div className="bg-[#9cb7c9]" style={{ height: `${(point.tithes / max) * 192}px` }} />
                <div className="bg-[#6f8f7a]" style={{ height: `${(point.offerings / max) * 192}px` }} />
              </div>
              <div className="w-1/2 max-w-7 rounded-t-md bg-[#d79b7f]" style={{ height: `${(point.expenses / max) * 192}px` }} />
            </div>
            <span className="whitespace-nowrap text-[10.5px] text-muted">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadCsv(tab: "ingresos" | "gastos", income: IncomeRow[], expenses: ExpenseRow[], label: string) {
  const rows =
    tab === "ingresos"
      ? [["Fecha", "Año", "Semana", "Red", "Célula", "Servidor", "Ofrenda", "Diezmos"], ...income.map((row) => [row.date, row.year, row.week, row.network, row.cell, row.leader ?? "", row.offering, row.tithes])]
      : [["Fecha", "Categoría", "Detalle", "Registró", "Monto"], ...expenses.map((row) => [row.spent_on, row.category, row.detail, row.by, row.amount])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `zoe-${tab}-${label.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
  link.click();
}

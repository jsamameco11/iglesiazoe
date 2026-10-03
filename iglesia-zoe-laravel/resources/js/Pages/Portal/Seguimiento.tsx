import { router } from "@inertiajs/react";
import { FormEvent } from "react";
import { Stat } from "@/Components/admin/ui";
import PortalLayout from "@/Layouts/PortalLayout";
import { money } from "@/lib/access";

type Network = { id: string; code: string; name: string };
type Status = "met" | "not_met" | "missing";
type Row = {
  id: string;
  code: string;
  parent_id: string | null;
  leader_name: string | null;
  attendance: number;
  salvations: number;
  families: number;
  offering: number | null;
  tithes: number | null;
  status: Status;
};
type Totals = {
  cells: number;
  reports: number;
  met: number;
  attendance: number;
  salvations: number;
  families: number;
  offering: number | null;
  tithes: number | null;
};

const statuses: Record<Status, { label: string; tone: string }> = {
  met: { label: "Se reunió", tone: "bg-emerald-50 text-emerald-800" },
  not_met: { label: "No se reunió", tone: "bg-blush text-[#8a4a33]" },
  missing: { label: "Sin informe", tone: "bg-paper text-muted" },
};

const cell = "px-4 py-3";
const number = `${cell} text-right tabular-nums`;

export default function Seguimiento({
  networks,
  network,
  rows,
  totals,
  showMoney,
  filters,
  staff,
  weeks,
}: {
  networks: Network[];
  network: Network | null;
  rows: Row[];
  totals: Totals;
  showMoney: boolean;
  filters: { year: number; week: number };
  staff: boolean;
  weeks: { week: number; label: string }[];
}) {
  const weekLabel = weeks.find((item) => item.week === filters.week)?.label ?? `Semana ${filters.week}`;
  const total = (totals.offering ?? 0) + (totals.tithes ?? 0);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    router.get("/portal/seguimiento", Object.fromEntries(data.entries()));
  }

  return (
    <PortalLayout>
      <h1 className="display text-4xl">Seguimiento</h1>
      <p className="mt-2 text-muted">Registro de seguimiento de grupos celulares{network ? ` (RED ${network.code})` : ""} · {weekLabel} · {filters.year}.</p>
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

      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${showMoney ? "xl:grid-cols-6" : "xl:grid-cols-3"}`}>
        <Stat label="Informes enviados" value={`${totals.reports} / ${totals.cells}`} note={`${totals.met} ${totals.met === 1 ? "célula se reunió" : "células se reunieron"}`} tone="bg-blush" />
        <Stat label="Asistencia" value={totals.attendance} note={`${totals.families} ${totals.families === 1 ? "familia" : "familias"}`} tone="bg-mist" />
        <Stat label="Nuevos creyentes" value={totals.salvations} note="Aceptaron a Jesús esta semana" tone="bg-sky" />
        {showMoney && (
          <>
            <Stat label="Ofrenda" value={money(totals.offering)} note="Suma de las ofrendas de célula" tone="bg-amber" />
            <Stat label="Diezmos" value={money(totals.tithes)} note="Registrados por integrante" tone="bg-sage" />
            <Stat label="Total recaudado" value={money(total)} note="Ofrenda más diezmos" tone="bg-white" />
          </>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-line bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-orange text-left text-white">
            <tr>
              <th className={cell}>#</th>
              <th className={cell}>Código</th>
              <th className={cell}>Líder</th>
              <th className={`${cell} text-right`}>Asistencia</th>
              <th className={`${cell} text-right`}>N. creyente</th>
              <th className={`${cell} text-right`}>Cant. familia</th>
              {showMoney && (
                <>
                  <th className={`${cell} text-right`}>Ofrenda</th>
                  <th className={`${cell} text-right`}>Diezmo</th>
                  <th className={`${cell} text-right`}>Total</th>
                </>
              )}
              <th className={cell}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-line">
                <td className={`${cell} text-muted`}>{index + 1}</td>
                <td className={`${cell} font-semibold`} style={{ paddingLeft: row.parent_id ? 28 : 16 }}>{row.code}</td>
                <td className={cell}>{row.leader_name || "—"}</td>
                <td className={number}>{row.attendance}</td>
                <td className={number}>{row.salvations}</td>
                <td className={number}>{row.families}</td>
                {showMoney && (
                  <>
                    <td className={number}>{money(row.offering)}</td>
                    <td className={number}>{money(row.tithes)}</td>
                    <td className={`${number} font-semibold`}>{money((row.offering ?? 0) + (row.tithes ?? 0))}</td>
                  </>
                )}
                <td className={cell}>
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${statuses[row.status].tone}`}>{statuses[row.status].label}</span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr className="border-t border-line">
                <td className="px-4 py-8 text-center text-muted" colSpan={showMoney ? 10 : 7}>Esta red todavía no tiene células activas.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-paper/60 font-semibold">
              <td className={cell} colSpan={3}>Total · {totals.reports} de {totals.cells} informes enviados</td>
              <td className={number}>{totals.attendance}</td>
              <td className={number}>{totals.salvations}</td>
              <td className={number}>{totals.families}</td>
              {showMoney && (
                <>
                  <td className={number}>{money(totals.offering)}</td>
                  <td className={number}>{money(totals.tithes)}</td>
                  <td className={number}>{money(total)}</td>
                </>
              )}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </PortalLayout>
  );
}

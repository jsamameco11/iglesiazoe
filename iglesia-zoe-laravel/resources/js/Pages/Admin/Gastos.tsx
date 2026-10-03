import { router } from "@inertiajs/react";
import { useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { Notice, PageHeader, Panel, button, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { money } from "@/lib/access";
import { limaDate } from "@/lib/dates";

export type ExpenseRow = { id: string; spent_on: string; category: string; detail: string; amount: number; by: string; receipt: string | null; is_pdf: boolean };

export default function Gastos({ month, categories, all, total, rows }: { month: string; categories: string[]; all: boolean; total: string; rows: ExpenseRow[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const { result, setResult, pending, run } = useAction();
  const today = limaDate();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    run(() => send("/admin/gastos", new FormData(form)), () => { form.reset(); setPreview(null); });
  }

  function remove(row: ExpenseRow) {
    if (!window.confirm(`¿Eliminar el gasto «${row.detail}» por ${money(row.amount)}?`)) return;
    run(() => send("/admin/gastos/eliminar", { id: row.id }));
  }

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Atmósfera"
          title="Gastos y compras"
          text={all ? "Todos los gastos registrados por el equipo Atmósfera, con su boleta o factura." : "Registra cada compra de la iglesia con la foto de la boleta o factura. El SUPERADMI la verá en Finanzas."}
          aside={<div className="rounded-2xl border border-line bg-white px-5 py-3 text-right"><p className="text-2xl font-semibold">{total}</p><p className="text-[11px] uppercase tracking-wider text-muted">total del mes</p></div>}
        />
        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Panel title="Registrar gasto" text="Todos los campos son obligatorios.">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted">Fecha de compra<input type="date" name="spent_on" defaultValue={today} max={today} required className={input} /></label>
                <label className="text-xs font-semibold text-muted">Monto (S/)<input type="number" name="amount" step="0.01" min="0.1" required className={input} placeholder="0.00" inputMode="decimal" /></label>
              </div>
              <label className="block text-xs font-semibold text-muted">Categoría
                <select name="category" className={input} defaultValue={categories[0]}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label className="block text-xs font-semibold text-muted">Detalle de lo que se compró<textarea name="detail" rows={3} required minLength={3} className={input} placeholder="Ej. 2 galones de lejía y 4 paquetes de papel para el baño" /></label>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-line bg-white p-4 text-center transition hover:border-ink/30">
                <input
                  type="file"
                  name="receipt"
                  accept="image/*,application/pdf"
                  required
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPreview(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : file ? "pdf" : null);
                  }}
                />
                {preview && preview !== "pdf" ? (
                  <img src={preview} alt="Boleta o factura" className="mx-auto max-h-56 rounded-xl object-contain" />
                ) : (
                  <span className="block py-4 text-sm">
                    <span className="block font-semibold">{preview === "pdf" ? "PDF seleccionado ✓" : "Foto de la boleta o factura (obligatoria)"}</span>
                    <span className="mt-1 block text-xs text-muted">Toca para tomar una foto o elegir un archivo (imagen o PDF, hasta 12 MB)</span>
                  </span>
                )}
              </label>
              <Notice result={result} onClose={() => setResult(null)} />
              <button disabled={pending} className={button}>{pending ? "Guardando…" : "Registrar gasto"}</button>
            </form>
          </Panel>
          <Panel
            title="Gastos del mes"
            text={`${rows.length} registro${rows.length === 1 ? "" : "s"}`}
            actions={<input type="month" defaultValue={month} onChange={(event) => event.target.value && router.get("/admin/gastos", { mes: event.target.value }, { preserveScroll: true })} className={`${input} mt-0 w-auto`} />}
          >
            <div className="divide-y divide-line">
              {rows.map((row) => (
                <div key={row.id} className="flex gap-4 py-4 first:pt-0">
                  {row.receipt ? (
                    <a href={row.receipt} target="_blank" rel="noreferrer" className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-paper text-[10px] font-semibold text-muted">
                      {row.is_pdf ? "PDF" : <img src={row.receipt} alt="Boleta o factura" className="h-full w-full object-cover" loading="lazy" />}
                    </a>
                  ) : <span className="h-16 w-16 shrink-0 rounded-xl bg-paper" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-5">{row.detail}</p>
                      <p className="shrink-0 text-sm font-semibold">{money(row.amount)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted">{row.spent_on.split("-").reverse().join("/")} · {row.category}{all ? ` · ${row.by}` : ""}</p>
                    <button type="button" onClick={() => remove(row)} className="mt-1.5 text-xs font-semibold text-red-700">Eliminar</button>
                  </div>
                </div>
              ))}
              {!rows.length && <p className="py-10 text-center text-sm text-muted">No hay gastos en este mes.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}

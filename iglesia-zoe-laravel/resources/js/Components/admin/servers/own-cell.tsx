import { Link } from "@inertiajs/react";
import { Notice, Panel, button, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/next-service";
import type { OwnCell } from "./types";

/** The Servidor de Red's own cell: shown once he leads one, or the form to open it himself. */
export function OwnCellPanel({ own }: { own: OwnCell }) {
  const { result, setResult, pending, run } = useAction();

  if (own.cell) {
    const schedule = [own.cell.meeting_day, own.cell.meeting_time].filter(Boolean).join(" · ") || "Horario por definir";
    return (
      <Panel title="Mi célula" text={`Además de servir a la Red ${own.network_code}, lideras tu propia célula.`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 min-w-11 place-items-center rounded-xl bg-ink px-2 text-sm font-semibold text-white">{own.cell.code}</span>
            <div>
              <p className="font-semibold tracking-[-0.02em]">{own.cell.leader_name || "Mi célula"}</p>
              <p className="text-xs text-muted">{schedule}</p>
            </div>
          </div>
          <Link href="/portal/informe" className={button}>Subir su informe</Link>
        </div>
      </Panel>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => send("/admin/servidores/mi-celula", new FormData(event.currentTarget)));
  }

  return (
    <Panel
      title="¿Lideras una célula?"
      text={`Si además de servir a la Red ${own.network_code} lideras tu propia célula, ábrela aquí. Se crea la célula ${own.next_code} a tu nombre y podrás subir su informe cada semana. Si no lideras una, no hace falta.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">Día de reunión
            <select name="meeting_day" className={input} defaultValue=""><option value="">Por definir</option>{WEEKDAYS.map((day) => <option key={day}>{day}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-muted">Hora<input type="time" name="meeting_time" className={input} /></label>
        </div>
        <Notice result={result} onClose={() => setResult(null)} />
        <button disabled={pending} className={button}>{pending ? "Abriendo…" : "Abrir mi célula"}</button>
      </form>
    </Panel>
  );
}

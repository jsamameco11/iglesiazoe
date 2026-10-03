import { useState } from "react";
import { Link } from "@inertiajs/react";
import { Notice, Panel, button, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/next-service";
import type { OwnCell, OwnCellChoices } from "./types";

type Kind = "network" | "numbered" | "existing";

/** The Servidor de Red's own cell: shown once he leads one, or the form to open it himself. */
export function OwnCellPanel({ own }: { own: OwnCell }) {
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

  return own.choices ? <OpenOwnCell networkCode={own.network_code} choices={own.choices} /> : null;
}

function OpenOwnCell({ networkCode, choices }: { networkCode: string; choices: OwnCellChoices }) {
  const { result, setResult, pending, run } = useAction();
  const [kind, setKind] = useState<Kind>(choices.network ? "network" : "numbered");
  const [cellId, setCellId] = useState(choices.free[0]?.id ?? "");
  const options: { kind: Kind; code: string; title: string; text: string }[] = [
    ...(choices.network
      ? [{ kind: "network" as const, code: choices.network, title: `Célula ${choices.network}`, text: `Lleva solo la letra de la red. Es la célula del Servidor de Red y no ocupa el número de ningún servidor.` }]
      : []),
    { kind: "numbered", code: choices.numbered, title: `Célula ${choices.numbered}`, text: "Se abre como una célula más de la red, con el siguiente número libre." },
    ...(choices.free.length
      ? [{ kind: "existing" as const, code: "↺", title: "Tomar una célula existente", text: "Una célula de tu red que todavía no tiene cuenta pasa a estar a tu nombre." }]
      : []),
  ];
  const selected = kind === "existing" ? choices.free.find((cell) => cell.id === cellId)?.code : options.find((option) => option.kind === kind)?.code;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => send("/admin/servidores/mi-celula", new FormData(event.currentTarget)));
  }

  return (
    <Panel
      title="¿Lideras una célula?"
      text={`Si además de servir a la Red ${networkCode} lideras tu propia célula, ábrela aquí y podrás subir su informe cada semana. Si no lideras una, no hace falta.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="text-xs font-semibold text-muted">¿Cómo quieres tu célula?</legend>
          <div className={`mt-2 grid gap-3 ${options.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>
            {options.map((option) => (
              <label
                key={option.kind}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${kind === option.kind ? "border-ink bg-paper" : "border-line bg-white hover:border-ink/40"}`}
              >
                <input type="radio" name="kind" value={option.kind} checked={kind === option.kind} onChange={() => setKind(option.kind)} className="sr-only" />
                <span className={`grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-2 text-sm font-semibold ${kind === option.kind ? "bg-ink text-white" : "bg-paper text-ink"}`}>{option.code}</span>
                <span>
                  <span className="block text-sm font-semibold tracking-[-0.02em]">{option.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{option.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {kind === "existing" ? (
          <label className="block text-xs font-semibold text-muted">Célula
            <select name="cell_id" className={input} value={cellId} onChange={(event) => setCellId(event.target.value)}>
              {choices.free.map((cell) => <option key={cell.id} value={cell.id}>{cell.code}{cell.leader_name ? ` · ${cell.leader_name}` : ""}</option>)}
            </select>
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">Día de reunión
              <select name="meeting_day" className={input} defaultValue=""><option value="">Por definir</option>{WEEKDAYS.map((day) => <option key={day}>{day}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-muted">Hora<input type="time" name="meeting_time" className={input} /></label>
          </div>
        )}
        <Notice result={result} onClose={() => setResult(null)} />
        <button disabled={pending} className={button}>{pending ? "Guardando…" : `Quedarme con la célula ${selected ?? ""}`.trim()}</button>
      </form>
    </Panel>
  );
}

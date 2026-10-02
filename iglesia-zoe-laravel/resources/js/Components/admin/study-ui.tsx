import type { FormEvent, ReactNode } from "react";
import { Notice, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send, type ActionResult } from "@/lib/actions";
import type { LevelOption } from "@/lib/studies";

export const STUDY_KICKER = "Estudios · Ruta del Servidor";

export function LevelSelect({ levels, value, name = "study_level_id", label = "Nivel", allLabel = "Todos los niveles" }: { levels: LevelOption[]; value?: string | null; name?: string; label?: string; allLabel?: string | null }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <select name={name} defaultValue={value ?? ""} className={input}>
        {allLabel !== null ? <option value="">{allLabel}</option> : null}
        {levels.map((level) => (
          <option key={level.id} value={level.id}>{level.name}</option>
        ))}
      </select>
    </label>
  );
}

export function Pill({ children, tone = "bg-paper text-muted" }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{children}</span>;
}

/**
 * A card form posting to an admin endpoint. Shows the server message and, for
 * existing records, a delete button that asks for confirmation first.
 */
export function RecordForm({
  url,
  id,
  deleteUrl,
  confirmText,
  submitLabel,
  onDone,
  onCancel,
  children,
  className = "",
  multipart = false,
}: {
  url: string;
  id?: string;
  deleteUrl?: string;
  confirmText?: string;
  submitLabel: string;
  onDone?: (result: ActionResult) => void;
  onCancel?: () => void;
  children: ReactNode;
  className?: string;
  multipart?: boolean;
}) {
  const { result, setResult, pending, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () => send(url, data),
      (next) => {
        if (!id) form.reset();
        onDone?.(next);
      },
    );
  }

  function remove() {
    if (!id || !deleteUrl || !window.confirm(confirmText || "¿Eliminar?")) return;
    run(() => send(deleteUrl, { id }));
  }

  return (
    <form onSubmit={submit} encType={multipart ? "multipart/form-data" : undefined} className={`grid gap-3 rounded-[1.4rem] border border-line bg-card p-4 md:p-5 ${className}`}>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {children}
      <Notice result={result} onClose={() => setResult(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className={button}>{pending ? "Guardando…" : submitLabel}</button>
        {onCancel ? <button type="button" onClick={onCancel} className={ghost}>{result?.ok ? "Cerrar" : "Cancelar"}</button> : null}
        {id && deleteUrl ? (
          <button type="button" disabled={pending} onClick={remove} className="ml-auto rounded-full px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50">
            Eliminar
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`text-xs font-semibold text-muted ${className}`}>
      {label}
      {children}
      {hint ? <span className="mt-1 block text-[11px] font-normal leading-4 text-muted">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-[1.4rem] border border-dashed border-line px-5 py-8 text-center text-sm text-muted">{children}</p>;
}

import { Notice, Panel, button, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/next-service";
import { levels, type ServerLevel } from "./types";

type Props = {
  level: ServerLevel;
  title: string;
  text?: string;
  url: string;
  hidden: Record<string, string>;
  submitLabel?: string;
  inline?: boolean;
  onCancel?: () => void;
  onDone?: () => void;
};

export function ServerForm({ level, title, text, url, hidden, submitLabel = "Crear", inline, onCancel, onDone }: Props) {
  const { result, setResult, pending, run } = useAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    Object.entries(hidden).forEach(([key, value]) => data.set(key, value));
    run(() => send(url, data), () => {
      form.reset();
      onDone?.();
    });
  }

  const fields = (
    <form onSubmit={submit} className="space-y-4">
      {level === "red" ? (
        <>
          <label className="block text-xs font-semibold text-muted">Nombre completo<input name="name" required className={input} placeholder="Ej. Carlos Mendoza" /></label>
          <AccountFields level={level} required />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted sm:col-span-2">Nombre del servidor<input name="leader_name" required maxLength={120} className={input} placeholder="Ej. Juan Pérez" /></label>
            <label className="text-xs font-semibold text-muted">Día de reunión
              <select name="meeting_day" className={input} defaultValue=""><option value="">Por definir</option>{WEEKDAYS.map((day) => <option key={day}>{day}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-muted">Hora<input type="time" name="meeting_time" className={input} /></label>
          </div>
          <AccountFields level={level} />
        </>
      )}
      <Notice result={result} onClose={() => setResult(null)} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={button}>{pending ? "Guardando…" : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm font-semibold text-muted hover:text-ink">Cancelar</button>}
      </div>
    </form>
  );

  if (inline) {
    return (
      <div className="rounded-2xl border border-line bg-paper/60 p-4">
        <p className="text-sm font-semibold">{title}</p>
        {text && <p className="mt-0.5 mb-3 text-xs text-muted">{text}</p>}
        {fields}
      </div>
    );
  }

  return <Panel title={title} text={text}>{fields}</Panel>;
}

export function AccountForm({ cellId, level, onCancel }: { cellId: string; level: ServerLevel; onCancel: () => void }) {
  const { result, setResult, pending, run } = useAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("cell_id", cellId);
    run(() => send("/admin/servidores/cuenta", data));
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-2xl border border-line bg-paper/60 p-4">
      <AccountFields level={level} required title="Nueva cuenta" />
      <Notice result={result} onClose={() => setResult(null)} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={button}>{pending ? "Creando…" : "Crear cuenta"}</button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-muted hover:text-ink">Cancelar</button>
      </div>
    </form>
  );
}

function AccountFields({ level, required, title }: { level: ServerLevel; required?: boolean; title?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold text-muted">{title ?? (required ? "Cuenta para ingresar" : "Cuenta para ingresar (opcional)")}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <input name="username" required={required} className={input} placeholder="Usuario o DNI" autoComplete="off" />
        <input name="password" type="text" required={required} minLength={6} className={input} placeholder="Clave (mínimo 6)" autoComplete="new-password" />
      </div>
      <p className="mt-2 text-[11.5px] leading-4 text-muted">{levels[level].account} Ingresa por la web de la iglesia.</p>
    </div>
  );
}

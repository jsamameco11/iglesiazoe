import { useEffect, useState, type FormEvent } from "react";
import { send, type ActionResult } from "@/lib/actions";
import type { StudyReading } from "@/lib/studies";

export function PdfViewer({ reading, onClose }: { reading: StudyReading; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="aula-modal" role="dialog" aria-modal="true" aria-label={reading.title}>
      <button type="button" className="aula-modal-scrim" aria-label="Cerrar" onClick={onClose} />
      <div className="aula-viewer">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <p className="min-w-0 truncate font-semibold">{reading.title}</p>
          <div className="flex shrink-0 gap-2">
            <a href={reading.file_url} target="_blank" rel="noreferrer" className="rounded-full border border-ink/10 px-3 py-1.5 text-sm font-semibold hover:border-ink/30">Abrir aparte ↗</a>
            <button type="button" onClick={onClose} className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-white">Cerrar</button>
          </div>
        </div>
        <iframe src={reading.file_url} title={reading.title} className="h-full w-full flex-1 bg-white" />
      </div>
    </div>
  );
}

export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const field = "mt-1.5 w-full rounded-xl border border-ink/12 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ink/40";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const next = await send("/estudios/clave", new FormData(event.currentTarget));
    setPending(false);
    setResult(next);
  }

  return (
    <div className="aula-modal" role="dialog" aria-modal="true" aria-label="Cambiar mi clave">
      <button type="button" className="aula-modal-scrim" aria-label="Cerrar" onClick={onClose} />
      <form onSubmit={submit} className="aula-dialog">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Cambiar mi clave</h2>
        <p className="mt-1 text-sm text-muted">Usa al menos 6 caracteres que puedas recordar.</p>
        <label className="mt-4 block text-sm font-medium">Clave actual<input name="current" type="password" required autoComplete="current-password" className={field} /></label>
        <label className="mt-3 block text-sm font-medium">Nueva clave<input name="password" type="password" required minLength={6} autoComplete="new-password" className={field} /></label>
        <label className="mt-3 block text-sm font-medium">Repite la nueva clave<input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={field} /></label>
        {result?.error || result?.message ? (
          <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${result.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{result.error || result.message}</p>
        ) : null}
        <div className="mt-5 flex gap-2">
          {result?.ok ? (
            <button type="button" onClick={onClose} className="btn-accent rounded-full px-5 py-2.5 text-sm font-semibold">Listo</button>
          ) : (
            <>
              <button disabled={pending} className="btn-accent rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{pending ? "Guardando…" : "Guardar clave"}</button>
              <button type="button" onClick={onClose} className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold">Cancelar</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

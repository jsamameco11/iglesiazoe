import { useActionState, useState } from "react";
import { deleteChurchEvent, saveChurchEvent, type ActionResult } from "@/lib/actions";
import { eventDateLabel } from "@/lib/events";
import AdminLayout from "@/Layouts/AdminLayout";
import type { ChurchEvent } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export default function Eventos({ events, today }: { events: ChurchEvent[]; today: string }) {
  const [creating, setCreating] = useState(false);
  const upcoming = events.filter((event) => (event.ends_on || event.starts_on) >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const past = events.filter((event) => (event.ends_on || event.starts_on) < today);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Eventos</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Publica los próximos eventos con su imagen editada (Día de la madre, retiros, reuniones de jóvenes…). Aparecen como carrusel en la página de inicio y en /eventos, y se ocultan solos cuando pasa la fecha.
      </p>
      <div className="mt-6">
        {creating ? (
          <EventForm today={today} onDone={() => setCreating(false)} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            + Nuevo evento
          </button>
        )}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Próximos ({upcoming.length})</h2>
      {upcoming.length ? (
        <div className="mt-4 grid gap-6">
          {upcoming.map((event) => <EventForm key={event.id} event={event} today={today} />)}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">Aún no hay eventos próximos. Mientras tanto, la sección de eventos no se muestra en la web.</p>
      )}

      {past.length ? (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.18em] text-muted">Eventos pasados ({past.length})</summary>
          <div className="mt-4 grid gap-6 opacity-80">
            {past.map((event) => <EventForm key={event.id} event={event} today={today} />)}
          </div>
        </details>
      ) : null}
    </AdminLayout>
  );
}

function EventForm({ event, today, onDone }: { event?: ChurchEvent; today: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveChurchEvent(formData);
    if (result?.ok) {
      setPreview(null);
      onDone?.();
    }
    return result;
  }, undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const image = preview || event?.image || null;

  async function remove() {
    if (!event || !window.confirm(`¿Eliminar el evento «${event.title}»? Ya no aparecerá en la web.`)) return;
    setBusy(true);
    setError("");
    const result = await deleteChurchEvent(event.id);
    if (result?.error) setError(result.error);
    setBusy(false);
  }

  return (
    <form action={action} className="grid gap-5 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-[220px_1fr]">
      <input type="hidden" name="id" value={event?.id || ""} />
      <div>
        <div className="flex aspect-[4/5] w-full max-w-[180px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-stone md:max-w-none">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-4 text-center text-xs text-muted">Sin imagen. Se usará la foto general de eventos.</span>
          )}
        </div>
        <label className="mt-3 block text-sm">
          {event?.image ? "Cambiar imagen" : "Imagen del evento"}
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 block w-full text-xs"
          />
        </label>
        <p className="mt-1 text-[11px] leading-4 text-muted">JPG, PNG o WEBP hasta 8 MB. Ideal vertical (4:5) o cuadrada.</p>
        {event?.image ? (
          <label className="mt-2 block text-xs text-muted"><input type="checkbox" name="remove_image" /> Quitar imagen</label>
        ) : null}
      </div>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium tracking-[-0.02em]">{event ? event.title : "Nuevo evento"}</h3>
            {event ? <p className="text-xs text-muted">{eventDateLabel(event.starts_on, event.ends_on)}{event.active ? "" : " · oculto"}</p> : null}
          </div>
          {event ? (
            <button type="button" disabled={busy} onClick={remove} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 disabled:opacity-40">
              Eliminar
            </button>
          ) : null}
        </div>
        <label className="text-sm">Título<input name="title" required maxLength={160} defaultValue={event?.title} placeholder="Ej. Retiro de servidores" className={field} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Fecha de inicio<input name="starts_on" type="date" required defaultValue={event?.starts_on || today} className={field} /></label>
          <label className="text-sm">Fecha de cierre <span className="text-muted">(opcional)</span><input name="ends_on" type="date" defaultValue={event?.ends_on || ""} className={field} /></label>
          <label className="text-sm">Hora<input name="time_label" maxLength={60} defaultValue={event?.time_label || ""} placeholder="Ej. 7:00 p. m." className={field} /></label>
        </div>
        <label className="text-sm">Lugar<input name="location" maxLength={160} defaultValue={event?.location || ""} placeholder="Ej. Auditorio principal" className={field} /></label>
        <label className="text-sm">Resumen<input name="summary" maxLength={300} defaultValue={event?.summary || ""} placeholder="Una frase que invite a venir" className={field} /></label>
        <label className="text-sm">Información completa<textarea name="body" maxLength={3000} rows={4} defaultValue={event?.body || ""} placeholder="Detalles, qué llevar, inversión, inscripciones…" className={field} /></label>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="text-sm">Texto del botón<input name="cta_label" maxLength={40} defaultValue={event?.cta_label || ""} placeholder="Ej. Inscribirme" className={field} /></label>
          <label className="text-sm">Enlace del botón<input name="cta_url" maxLength={500} defaultValue={event?.cta_url || ""} placeholder="https://forms.gle/… o https://wa.me/…" className={field} /></label>
        </div>
        <label className="text-sm"><input type="checkbox" name="active" defaultChecked={event ? event.active : true} /> Visible en la web</label>
        {(state?.error || error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state?.error || error}</p>}
        {state?.ok && event && <p className="rounded-xl bg-sage px-3 py-2 text-sm">{state.message || "Guardado."}</p>}
        <div className="flex gap-3">
          <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Guardando…" : event ? "Guardar" : "Publicar evento"}
          </button>
          {!event && onDone ? <button type="button" onClick={onDone} className="rounded-full border border-line bg-white px-5 py-2 text-sm">Cancelar</button> : null}
        </div>
      </div>
    </form>
  );
}

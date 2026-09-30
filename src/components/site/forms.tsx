"use client";

import { useActionState } from "react";
import { submitBaptism, submitPrayer, submitVisit } from "@/app/actions/auth";

function Note({ state }: { state: { ok?: boolean; error?: string } | undefined }) {
  if (state?.ok) return <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Recibimos tu mensaje. Gracias por escribirnos.</p>;
  if (state?.error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>;
  return null;
}

const field = "mt-2 w-full border-0 border-b border-ink/15 bg-transparent px-0 py-3 outline-none focus:border-ink";

export function VisitForm() {
  const [state, action, pending] = useActionState(submitVisit, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Note state={state} />
      <label className="text-sm">Nombre<input name="full_name" required className={field} /></label>
      <label className="text-sm">Teléfono<input name="phone" required className={field} /></label>
      <label className="text-sm">Correo<input name="email" type="email" className={field} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Fecha que te gustaría venir<input name="visit_date" type="date" className={field} /></label>
        <label className="text-sm">Servicio
          <select name="service" className={field}>
            <option>Domingo 10:00 a.m.</option>
            <option>Miércoles 8:00 p.m.</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Adultos<input name="adults" type="number" min={1} defaultValue={1} className={field} /></label>
        <label className="text-sm">Niños<input name="children" type="number" min={0} defaultValue={0} className={field} /></label>
      </div>
      <label className="text-sm">¿Algo que debamos saber?<textarea name="notes" rows={3} className={field} /></label>
      <button disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Enviando…" : "Quiero visitarlos"}
      </button>
    </form>
  );
}

export function BaptismForm({ events }: { events: { id: string; event_date: string | null; location: string | null }[] }) {
  const [state, action, pending] = useActionState(submitBaptism, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Note state={state} />
      <label className="text-sm">Nombre completo<input name="full_name" required className={field} /></label>
      <label className="text-sm">Teléfono<input name="phone" required className={field} /></label>
      <label className="text-sm">Correo<input name="email" type="email" className={field} /></label>
      {events.length > 0 && (
        <label className="text-sm">Fecha
          <select name="event_id" className={field}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.event_date ? new Date(event.event_date + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }) : "Fecha por confirmar"}
                {event.location ? ` · ${event.location}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm">Cuéntanos tu decisión<textarea name="notes" rows={3} className={field} /></label>
      <button disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Enviando…" : "¡Quiero bautizarme!"}
      </button>
    </form>
  );
}

export function PrayerForm() {
  const [state, action, pending] = useActionState(submitPrayer, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Note state={state} />
      <label className="text-sm">Nombre<input name="full_name" required className={field} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Teléfono<input name="phone" className={field} /></label>
        <label className="text-sm">Correo<input name="email" type="email" className={field} /></label>
      </div>
      <label className="text-sm">Petición de oración<textarea name="request" required rows={5} className={field} /></label>
      <button disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Enviando…" : "Enviar petición"}
      </button>
    </form>
  );
}

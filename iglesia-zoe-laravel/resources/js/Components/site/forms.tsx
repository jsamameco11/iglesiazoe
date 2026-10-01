
import { useActionState } from "react";
import { submitPrayer } from "@/lib/actions";

function Note({ state }: { state: { ok?: boolean; error?: string } | undefined }) {
  if (state?.ok) return <p className="rounded-2xl bg-sage px-4 py-3 text-sm text-ink">Recibimos tu mensaje. Gracias por escribirnos.</p>;
  if (state?.error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>;
  return null;
}

const field = "mt-2 w-full border-0 border-b border-ink/15 bg-transparent px-0 py-3 outline-none focus:border-ink";

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
      <button disabled={pending} className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Enviando…" : "Enviar petición"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";

const field = "mt-2 w-full border-0 border-b border-ink/20 bg-transparent px-0 py-3 text-ink outline-none focus:border-ink";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="w-full">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted">Grupos celulares</p>
      <h1 className="display mt-3 text-5xl">Ingresar</h1>
      {state?.error && <p className="mt-4 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="next" value={next || ""} />
      <label className="mt-8 block text-sm">Usuario
        <input name="username" required className={field} />
      </label>
      <label className="mt-5 block text-sm">Clave
        <input name="password" type="password" required className={field} />
      </label>
      <button disabled={pending} className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

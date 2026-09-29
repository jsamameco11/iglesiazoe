"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/5 p-8 text-white backdrop-blur">
      <p className="text-center text-xs font-medium uppercase tracking-[0.22em] text-orange">Control de grupos celulares</p>
      <h1 className="display mt-3 text-center text-4xl">Ingresar</h1>
      {state?.error && <p className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-100">{state.error}</p>}
      <input type="hidden" name="next" value={next || ""} />
      <label className="mt-6 block text-sm">Usuario
        <input name="username" required className="mt-2 w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-ink outline-none" />
      </label>
      <label className="mt-4 block text-sm">Clave
        <input name="password" type="password" required className="mt-2 w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-ink outline-none" />
      </label>
      <button disabled={pending} className="mt-6 w-full rounded-full bg-orange px-5 py-3 text-sm font-medium text-white">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

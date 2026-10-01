import { useForm } from "@inertiajs/react";

const field = "mt-1.5 w-full border-0 border-b border-ink/20 bg-transparent px-0 py-2.5 text-ink outline-none focus:border-ink";

export function LoginForm({ next }: { next?: string }) {
  const form = useForm({
    username: "",
    password: "",
    next: next || "",
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.post("/acceso");
      }}
      className="w-full"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] leading-none text-muted">Control de grupos CEREAL</p>
      <h1 className="editorial mt-3 text-[3.4rem] leading-[1.02]">Acceso al sistema</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-6 text-muted">
        Ingresa para enviar el informe semanal de tu grupo celular.
      </p>
      {(form.errors.username || form.errors.password) && (
        <p className="mt-3 text-sm leading-6 text-red-700">{form.errors.username || form.errors.password}</p>
      )}
      <label className="mt-6 block text-sm leading-5">
        Usuario o DNI
        <input
          name="username"
          autoComplete="username"
          required
          value={form.data.username}
          onChange={(event) => form.setData("username", event.target.value)}
          className={field}
        />
      </label>
      <label className="mt-4 block text-sm leading-5">
        Clave
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.data.password}
          onChange={(event) => form.setData("password", event.target.value)}
          className={field}
        />
      </label>
      <button disabled={form.processing} className="mt-7 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {form.processing ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

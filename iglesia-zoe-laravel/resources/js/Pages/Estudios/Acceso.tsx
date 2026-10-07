import { Link, useForm } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { ClassroomPreview } from "@/Components/classroom/preview";
import SiteLayout from "@/Layouts/SiteLayout";
import { talkUrlOf } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";

const field = "mt-1.5 w-full rounded-2xl border border-ink/12 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5";

export default function Acceso({ settings, levels }: { settings: SiteSettings; levels: string[] }) {
  const form = useForm({ username: "", password: "" });
  const error = form.errors.username || form.errors.password;

  return (
    <SiteLayout>
      <section className="page-wrap">
        <div {...section("form", "Formulario de acceso")} className="grid items-center gap-10 sm:gap-12 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-16">
          <Rise className="min-w-0">
            <p className="kicker">Estudios · Aula virtual</p>
            <h1 className="acceso-title mt-4">Acceso de estudiantes</h1>
            <p className="mt-4 max-w-md text-[1.05rem] font-light leading-7 text-muted">
              Ingresa con tu DNI y tu clave para ver tus notas, en qué semana vas, tu horario, las lecturas y los avisos de La Ruta del Servidor.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                form.post("/estudios/acceso", { onFinish: () => form.reset("password") });
              }}
              className="mt-8 grid gap-4"
            >
              {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}
              <label className="text-sm font-medium text-ink">
                DNI o usuario
                <input
                  name="username"
                  autoComplete="username"
                  inputMode="text"
                  required
                  value={form.data.username}
                  onChange={(event) => form.setData("username", event.target.value)}
                  className={field}
                />
              </label>
              <label className="text-sm font-medium text-ink">
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
              <button disabled={form.processing} className="btn-accent mt-2 w-full rounded-full px-6 py-3.5 text-[15px] font-semibold disabled:opacity-60">
                {form.processing ? "Ingresando…" : "Ingresar a mi aula"}
              </button>
            </form>
            <p className="mt-6 text-sm leading-6 text-muted">
              ¿Aún no tienes tu clave?{" "}
              <a href={talkUrlOf(settings, "Hola, soy estudiante de La Ruta del Servidor y necesito mi acceso al aula.")} target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">
                Pídela aquí
              </a>
              . La primera vez, tu clave suele ser tu mismo DNI.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link href="/ruta-del-servidor" className="text-muted underline-offset-4 hover:text-ink hover:underline">← La Ruta del Servidor</Link>
              <Link href="/acceso" className="text-muted underline-offset-4 hover:text-ink hover:underline">¿Eres servidor? Acceso al sistema</Link>
            </div>
          </Rise>

          <Rise from="right" delay={120} className="min-w-0">
            <ClassroomPreview levels={levels} />
          </Rise>
        </div>
      </section>
    </SiteLayout>
  );
}

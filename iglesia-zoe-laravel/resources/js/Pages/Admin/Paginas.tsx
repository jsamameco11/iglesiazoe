import { useActionState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { saveSitePage, type ActionResult } from "@/lib/actions";
import type { PageKey, SitePage } from "@/lib/site-pages";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

type PageDefaults = { name: string; note: string; kicker: string; sections: Record<string, string> };

export default function Paginas({ pages, defaults }: { pages: SitePage[]; defaults: Record<PageKey, PageDefaults> }) {
  const roots = pages.filter((page) => page.parent === null);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Páginas y secciones</h1>
      <p className="mt-2 max-w-2xl leading-7 text-muted">
        El nombre de cada página y de cada sección de la web pública. Lo que cambies aquí se ve al instante en el menú, el menú del celular, el pie de página, la
        etiqueta sobre el título de la página y los enlaces que llevan a ella.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        {roots.map((page) => (
          <a key={page.key} href={`#pagina-${page.key}`} className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink">
            {page.name}
          </a>
        ))}
      </nav>

      <div className="mt-8 grid max-w-3xl gap-10">
        {roots.map((root) => {
          const children = pages.filter((page) => page.parent === root.key);
          return (
            <section key={root.key} id={`pagina-${root.key}`} className="grid scroll-mt-6 gap-4 border-t border-line pt-8 first:border-0 first:pt-0">
              <PageForm page={root} defaults={defaults[root.key]} group={children.length > 0} />
              {children.length > 0 ? (
                <div className="grid gap-4 border-l-2 border-line pl-4 md:pl-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Dentro del menú «{root.name}»</p>
                  {children.map((child) => (
                    <PageForm key={child.key} page={child} defaults={defaults[child.key]} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </AdminLayout>
  );
}

function PageForm({ page, defaults, group = false }: { page: SitePage; defaults?: PageDefaults; group?: boolean }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => saveSitePage(formData), undefined);
  const original = (value: string | undefined) => (value ? `Original: ${value}` : undefined);

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white/60 p-5">
      <input type="hidden" name="key" value={page.key} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-medium tracking-[-0.03em]">{page.name}</h2>
        <a href={page.path} target="_blank" rel="noreferrer" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {page.path} ↗
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="name"
          label={group ? "Nombre del menú" : "Nombre de la página"}
          defaultValue={page.name}
          hint={original(defaults?.name) ?? "Menú, pie de página y enlaces."}
          required
        />
        <Field name="note" label="Nota en el menú" defaultValue={page.note} hint={original(defaults?.note) ?? "La línea pequeña bajo el nombre en los menús desplegables."} />
        {group ? null : (
          <Field
            name="kicker"
            label="Etiqueta sobre el título"
            defaultValue={page.kicker}
            hint={defaults?.kicker ? `Original: ${defaults.kicker}. Vacía: se usa el nombre de la página.` : "Vacía: se usa el nombre de la página."}
          />
        )}
      </div>

      {page.sections.length > 0 ? (
        <fieldset className="grid gap-3 border-t border-line pt-4">
          <legend className="pr-2 text-sm font-medium">Secciones de la página</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {page.sections.map((section) => (
              <Field
                key={section.key}
                name={`sections[${section.key}]`}
                label={defaults?.sections[section.key] ?? section.name}
                defaultValue={section.name}
                hint={original(defaults?.sections[section.key])}
                required
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {state?.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">{state.message || "Guardado."}</p>}
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-fit rounded-full bg-accent px-6 py-3 text-sm text-white disabled:opacity-60">
        {pending ? "Guardando…" : `Guardar ${page.name}`}
      </button>
    </form>
  );
}

function Field({ name, label, defaultValue, hint, required }: { name: string; label: string; defaultValue: string; hint?: string; required?: boolean }) {
  return (
    <label className="text-sm">
      {label}
      <input name={name} defaultValue={defaultValue} required={required} maxLength={name === "note" ? 120 : 80} className={field} />
      {hint ? <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

import { useActionState } from "react";
import { blankDefaults, CopyFields } from "@/Components/admin/copy-fields";
import AdminLayout from "@/Layouts/AdminLayout";
import { saveTexts, type ActionResult } from "@/lib/actions";
import { copyGroups } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export default function Textos({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => saveTexts(blankDefaults(formData)), undefined);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Textos por página</h1>
      <p className="mt-2 max-w-2xl leading-7 text-muted">
        Etiquetas, botones, menú, pie de página y textos de formularios. Si borras un campo, vuelve al texto original. Los títulos principales de cada página
        se editan en <a href="/admin/contenido" className="font-semibold text-ink underline-offset-4 hover:underline">Textos principales</a>.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        {copyGroups.map((group) => (
          <a key={group.id} href={`#${group.id}`} className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink">
            {group.title}
          </a>
        ))}
        <a href="#oracion-temas" className="rounded-full border border-line bg-white px-3 py-1.5 hover:border-ink">Motivos de oración</a>
      </nav>

      <form action={action} className="mt-8 grid max-w-3xl gap-4">
        {copyGroups.map((group) => (
          <section key={group.id} id={group.id} className="grid scroll-mt-6 gap-4 border-t border-line pt-8 first:border-0 first:pt-0">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.03em]">{group.title}</h2>
              {"note" in group && group.note ? <p className="mt-1 text-sm leading-6 text-muted">{group.note}</p> : null}
            </div>
            <CopyFields settings={settings} group={group} />
          </section>
        ))}

        <section id="oracion-temas" className="grid scroll-mt-6 gap-4 border-t border-line pt-8">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.03em]">Motivos de oración</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Las opciones del formulario de oración. Uno por línea, hasta 12.</p>
          </div>
          <textarea name="prayerTopics" defaultValue={(settings.prayerTopics || []).join("\n")} rows={8} className={field} />
        </section>

        {state?.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Guardado.</p>}
        {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="sticky bottom-4">
          <button disabled={pending} className="w-fit rounded-full bg-accent px-6 py-3 text-sm text-white shadow-lg disabled:opacity-60">{pending ? "Guardando…" : "Guardar textos"}</button>
        </div>
      </form>
    </AdminLayout>
  );
}

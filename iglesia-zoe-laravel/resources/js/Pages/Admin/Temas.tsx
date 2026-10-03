import { useRef, useState } from "react";
import { button, ghost, input, Notice, PageHeader, Panel, Stat, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { hideTheme, uploadTheme } from "@/lib/actions";
import { limaDate } from "@/lib/dates";
import type { Theme } from "@/lib/types";

const MAX_MB = 25;

function longDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function Temas({ themes, accept }: { themes: Theme[]; accept: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState("");
  const { result, setResult, pending, run } = useAction();
  const today = limaDate();
  const thisMonth = themes.filter((theme) => theme.theme_date.slice(0, 7) === today.slice(0, 7)).length;
  const next = [...themes].filter((theme) => theme.theme_date >= today).sort((a, b) => a.theme_date.localeCompare(b.theme_date))[0];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (file instanceof File && file.size > MAX_MB * 1024 * 1024) {
      setResult({ error: `El archivo pesa más de ${MAX_MB} MB. Comprímelo o expórtalo en PDF.` });
      return;
    }
    run(() => uploadTheme(data), () => {
      form.current?.reset();
      setFileName("");
    });
  }

  function hide(theme: Theme) {
    if (!window.confirm(`¿Ocultar «${theme.title}»? Los servidores dejarán de verlo.`)) return;
    run(() => hideTheme(theme.id));
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          kicker="Células"
          title="Temas de célula"
          text="Publica el material de cada semana. Los servidores lo ven al instante en su panel y pueden abrirlo o descargarlo."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Temas publicados" value={themes.length} tone="bg-white" />
          <Stat label="Este mes" value={thisMonth} tone="bg-orange/10" />
          <Stat label="Próximo tema" value={next ? next.theme_date.split("-").reverse().join("/") : "—"} note={next?.title} tone="bg-paper" />
        </div>

        <Notice result={result} onClose={() => setResult(null)} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
          <Panel title="Publicar un tema" text={`PDF, Word, PowerPoint o imagen, hasta ${MAX_MB} MB.`} className="xl:sticky xl:top-6 xl:self-start">
            <form ref={form} onSubmit={submit} className="grid gap-4">
              <label className="text-xs font-semibold text-muted">Título del tema
                <input name="title" required minLength={3} maxLength={160} placeholder="Ej. El poder de la oración" className={input} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted">Fecha
                  <input name="theme_date" type="date" required defaultValue={today} className={input} />
                </label>
                <label className="text-xs font-semibold text-muted">Dirigido a
                  <input name="audience" defaultValue="Iglesia" maxLength={80} className={input} />
                </label>
              </div>
              <label className="group block cursor-pointer rounded-2xl border border-dashed border-line bg-paper/60 px-4 py-6 text-center transition hover:border-ink/30">
                <input
                  name="file"
                  type="file"
                  required
                  accept={accept}
                  className="sr-only"
                  onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
                />
                <span className="block text-sm font-semibold">{fileName || "Elegir archivo"}</span>
                <span className="mt-1 block text-xs text-muted">{fileName ? "Toca para cambiarlo" : accept.replaceAll(",", " · ").toUpperCase()}</span>
              </label>
              <button disabled={pending} className={`${button} w-full sm:w-auto`}>
                {pending ? "Publicando…" : "Publicar tema"}
              </button>
            </form>
          </Panel>

          <Panel title="Publicados" text="Ordenados del más reciente al más antiguo.">
            {themes.length === 0 ? (
              <p className="rounded-2xl bg-paper px-4 py-10 text-center text-sm text-muted">Todavía no hay temas publicados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {themes.map((theme) => (
                  <li key={theme.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-[-0.01em]">{theme.title}</p>
                      <p className="mt-0.5 text-xs capitalize text-muted">
                        {longDate(theme.theme_date)} · {theme.audience}
                        {theme.file_type && <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold uppercase not-italic text-ink">{theme.file_type}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {theme.file_url && <a href={theme.file_url} target="_blank" rel="noreferrer" className={ghost}>Ver</a>}
                      {theme.download_url && <a href={theme.download_url} className={ghost}>Descargar</a>}
                      <button type="button" disabled={pending} onClick={() => hide(theme)} className={`${ghost} text-red-700 hover:border-red-300`}>Ocultar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}

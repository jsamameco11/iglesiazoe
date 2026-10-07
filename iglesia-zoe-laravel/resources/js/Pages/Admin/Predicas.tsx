import { router } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { SermonRow } from "@/Components/admin/sermons/sermon-row";
import type { AdminSermon, WatchSettings } from "@/Components/admin/sermons/types";
import { YouTubeWatch } from "@/Components/admin/sermons/youtube-watch";
import { button, ghost, input, Notice, PageHeader, Panel, Stat } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send, type ActionResult } from "@/lib/actions";

/** While a check runs in the background, reloads the panel until it finishes, then says what it found. */
function useWatchPolling(watch: WatchSettings, onDone: (result: ActionResult) => void) {
  const [wasRunning, setWasRunning] = useState(watch.running);
  useEffect(() => {
    if (!watch.running) return;
    const id = window.setInterval(() => router.reload({ only: ["youtube", "sermons"] }), 3000);
    return () => window.clearInterval(id);
  }, [watch.running]);

  useEffect(() => {
    if (wasRunning && !watch.running) {
      const run = watch.runs[0];
      if (run?.error) onDone({ error: `No se pudo revisar el canal: ${run.error}` });
      else if (run) {
        const found = (run.added ?? 0) + (run.pending ?? 0);
        onDone({
          message: found
            ? `Revisión lista: ${run.added ? `${run.added} publicados` : ""}${run.added && run.pending ? " y " : ""}${run.pending ? `${run.pending} por revisar` : ""}.`
            : `Revisión lista: no hay cultos nuevos en el canal${run.updated ? ` (${run.updated} actualizados)` : ""}.`,
        });
      }
    }
    setWasRunning(watch.running);
  }, [watch.running]);
}

export default function Predicas({ sermons, youtube }: { sermons: AdminSermon[]; youtube: WatchSettings }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  useWatchPolling(youtube, setResult);

  const pending = sermons.filter((sermon) => sermon.pending);
  const listed = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return sermons.filter((sermon) => !sermon.pending && words.every((word) => `${sermon.title} ${sermon.series || ""} ${sermon.preacher || ""}`.toLowerCase().includes(word)));
  }, [sermons, query]);
  const onSite = sermons.filter((sermon) => sermon.published && !sermon.pending).length;
  const fromYoutube = sermons.filter((sermon) => sermon.source === "youtube").length;

  async function act(task: () => Promise<ActionResult>) {
    setBusy(true);
    setResult(await task());
    setBusy(false);
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    act(async () => {
      const next = await send("/admin/predicas", new FormData(form));
      if (!next.error) {
        form.reset();
        setAdding(false);
      }
      return next;
    });
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          kicker="Contenido"
          title="Prédicas"
          text="Los cultos del canal de YouTube llegan solos a «Palabra para tu semana» del inicio y a la Biblioteca de Prédicas, y se reproducen dentro de la página."
          aside={
            <button type="button" className={ghost} onClick={() => setAdding((value) => !value)}>
              {adding ? "Cancelar" : "+ Agregar a mano"}
            </button>
          }
        />

        <Notice result={result} onClose={() => setResult(null)} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="En la página" value={onSite} note="Visibles en inicio y Prédicas" tone="bg-emerald-50" />
          <Stat label="Por revisar" value={pending.length} note={pending.length ? "Esperan tu aprobación" : "Nada pendiente"} tone={pending.length ? "bg-amber-50" : "bg-white"} />
          <Stat label="Desde YouTube" value={fromYoutube} note="Traídas por el buscador" />
          <Stat label="Total" value={sermons.length} note="Incluye las ocultas" />
        </div>

        {adding ? (
          <Panel title="Agregar una prédica a mano" text="Pega el enlace del video: al guardar, el buscador completa su duración, vistas y descripción desde YouTube en la próxima revisión.">
            <form onSubmit={add} className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-muted md:col-span-2">
                Enlace o ID de YouTube
                <input name="youtube_id" placeholder="https://www.youtube.com/watch?v=…" className={input} />
              </label>
              <label className="text-xs font-semibold text-muted md:col-span-2">
                Título
                <input name="title" required className={input} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Predicador
                <input name="preacher" className={input} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Serie
                <input name="series" placeholder={youtube.series_sunday} className={input} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Fecha del culto
                <input name="sermon_date" type="date" className={input} />
              </label>
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" name="published" value="1" defaultChecked /> Mostrar en la página
              </label>
              <div className="md:col-span-2">
                <button className={button} disabled={busy}>
                  Agregar prédica
                </button>
              </div>
            </form>
          </Panel>
        ) : null}

        {pending.length ? (
          <Panel
            title={`Videos nuevos por revisar (${pending.length})`}
            text="El buscador los encontró en el canal. Publícalos para que aparezcan en la página o descártalos para que no vuelvan."
            actions={
              <div className="flex flex-wrap gap-2">
                <button type="button" className={ghost} disabled={busy} onClick={() => window.confirm("¿Descartar todos los videos por revisar?") && act(() => send("/admin/predicas/revisar", { action: "discard", all: "1" }))}>
                  Descartar todos
                </button>
                <button type="button" className={button} disabled={busy} onClick={() => act(() => send("/admin/predicas/revisar", { action: "approve", all: "1" }))}>
                  Publicar todos
                </button>
              </div>
            }
          >
            <div className="space-y-3">
              {pending.map((sermon) => (
                <SermonRow key={sermon.id} sermon={sermon} onResult={setResult} />
              ))}
            </div>
          </Panel>
        ) : null}

        <YouTubeWatch watch={youtube} onResult={setResult} />

        <Panel
          title="Prédicas de la página"
          text="Ordenadas de la más reciente a la más antigua. Las ocultas no aparecen en la página."
          actions={<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, serie o predicador" className={`${input} mt-0 w-72`} />}
        >
          {listed.length ? (
            <div className="space-y-3">
              {listed.map((sermon) => (
                <SermonRow key={sermon.id} sermon={sermon} onResult={setResult} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{query ? "No hay prédicas con esa búsqueda." : "Todavía no hay prédicas. Pulsa «Buscar ahora» para traer los cultos del canal."}</p>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}

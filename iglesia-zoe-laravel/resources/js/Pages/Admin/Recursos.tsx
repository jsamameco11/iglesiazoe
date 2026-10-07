import { router } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { PublishDialog, type AdminTeaching, type VideoSettings } from "@/Components/admin/live/publish-dialog";
import { RecordingList } from "@/Components/admin/live/recordings";
import type { Catalog } from "@/Components/admin/live/types";
import { button, ghost, input, Notice, PageHeader, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { useSiteUrl } from "@/lib/access";
import { deleteTeaching, saveTeaching, type ActionResult } from "@/lib/actions";
import { formatDuration } from "@/lib/live";
import { fold } from "@/lib/text";
import type { TeachingKind } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

const KINDS: { id: TeachingKind; label: string }[] = [
  { id: "predica", label: "Enseñanza de la prédica" },
  { id: "gc", label: "Enseñanza para los GC" },
];

type Filter = "all" | "site" | "hidden" | TeachingKind;

function Badge({ teaching }: { teaching: AdminTeaching }) {
  const base = "rounded-full px-2.5 py-1 text-[11px] font-semibold";
  if (teaching.youtube_status === "uploading") {
    return <span className={`${base} bg-sky-50 text-sky-800`}>Subiendo a YouTube · {teaching.youtube_progress}%</span>;
  }
  if (teaching.youtube_status === "processing") {
    return <span className={`${base} bg-sky-50 text-sky-800`}>YouTube lo está procesando</span>;
  }
  if (teaching.youtube_status === "failed") {
    return <span className={`${base} bg-red-50 text-red-800`}>Falló la subida a YouTube</span>;
  }
  if (teaching.on_site) return <span className={`${base} bg-emerald-50 text-emerald-800`}>En la web</span>;
  if (!teaching.active) return <span className={`${base} bg-paper text-muted`}>Oculta</span>;
  if (teaching.youtube_id && teaching.youtube_privacy === "private") return <span className={`${base} bg-amber-50 text-amber-900`}>Video privado · no se muestra</span>;
  return <span className={`${base} bg-amber-50 text-amber-900`}>Falta el video de YouTube</span>;
}

function TeachingEditor({ teaching, accept, catalog, onSaved, onCancel }: { teaching?: AdminTeaching; accept: string; catalog: Catalog; onSaved: (result: ActionResult) => void; onCancel: () => void }) {
  const { result, setResult, pending, run } = useAction();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const [summary, setSummary] = useState(teaching?.summary ?? "");
  const [youtube, setYoutube] = useState(teaching?.youtube_id ? `https://youtu.be/${teaching.youtube_id}` : "");
  const ownVideo = Boolean(teaching?.youtube_id && teaching.youtube_options && youtube.includes(teaching.youtube_id));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    for (const flag of ["show_summary", "active", "remove_file", "remove_cover", "sync_youtube"]) {
      formData.set(flag, formData.get(flag) ? "1" : "0");
    }
    run(() => saveTeaching(formData), onSaved);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-t border-line pt-5">
      <input type="hidden" name="id" value={teaching?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-xs font-semibold text-muted">
          Título
          <input name="title" required minLength={3} maxLength={160} defaultValue={teaching?.title} placeholder="Ej. El poder de la gratitud" className={input} />
        </label>
        <label className="text-xs font-semibold text-muted">
          Tipo
          <select name="kind" defaultValue={teaching?.kind ?? "predica"} className={input}>
            {KINDS.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Fecha
          <input name="teaching_date" type="date" required defaultValue={teaching?.teaching_date ?? today} className={input} />
        </label>
      </div>
      <label className="text-xs font-semibold text-muted">
        Predicador
        <input name="preacher" maxLength={120} defaultValue={teaching?.preacher ?? ""} placeholder="Ej. Pastor Juan Pérez" className={input} />
      </label>
      <label className="text-xs font-semibold text-muted">
        Descripción <span className="font-normal">({summary.length}/5000)</span>
        <textarea name="summary" maxLength={5000} rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} className={input} />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="show_summary" defaultChecked={teaching?.show_summary ?? true} className="h-4 w-4 accent-[var(--accent)]" />
        Mostrar la descripción en la página web
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-muted">
          Video de YouTube
          <input name="youtube" value={youtube} onChange={(event) => setYoutube(event.target.value)} placeholder="Pega el enlace del video" className={input} />
          <span className="mt-1 block font-normal">Sin video de YouTube (o con video privado), la enseñanza no se muestra en la web salvo que tenga un archivo.</span>
        </label>
        <div className="text-xs font-semibold text-muted">
          Miniatura <span className="font-normal">(JPG o PNG hasta 2 MB · 1280 × 720)</span>
          <input name="cover" type="file" accept=".jpg,.jpeg,.png" className="mt-1.5 block w-full rounded-xl border border-dashed border-line bg-white px-3 py-2 text-xs font-normal" />
          {teaching?.cover ? (
            <label className="mt-1.5 flex items-center gap-2 font-normal">
              <input type="checkbox" name="remove_cover" /> Quitar la miniatura actual
            </label>
          ) : null}
        </div>
      </div>

      {ownVideo && teaching ? (
        <div className="grid gap-3 rounded-2xl border border-line bg-paper/60 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="sync_youtube" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span>
              <span className="font-semibold">Actualizar también en YouTube</span>
              <span className="mt-0.5 block text-xs text-muted">Envía el título, la descripción, la visibilidad y la miniatura al video del canal.</span>
            </span>
          </label>
          <label className="text-xs font-semibold text-muted">
            Visibilidad
            <select name="privacy" defaultValue={teaching.youtube_privacy ?? "public"} className={input}>
              {catalog.privacy.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="grid gap-2 text-xs font-semibold text-muted">
        {teaching?.file_url ? "Reemplazar archivo" : "Archivo para descargar"} <span className="font-normal">(opcional · PDF, Word, PowerPoint o imagen hasta 25 MB)</span>
        <input name="file" type="file" accept={accept} className="block w-full rounded-xl border border-dashed border-line bg-white px-3 py-2 text-xs font-normal" />
        {teaching?.file_url ? (
          <label className="flex items-center gap-2 font-normal">
            <input type="checkbox" name="remove_file" /> Quitar el archivo actual
          </label>
        ) : null}
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={teaching?.active ?? true} className="h-4 w-4 accent-[var(--accent)]" />
        Visible en la web (cuando tenga su video o archivo)
      </label>

      <Notice result={result} onClose={() => setResult(null)} />
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={pending}>
          {pending ? "Guardando…" : teaching ? "Guardar cambios" : "Guardar enseñanza"}
        </button>
        <button type="button" className={ghost} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function TeachingRow({
  teaching,
  accept,
  catalog,
  video,
  onResult,
}: {
  teaching: AdminTeaching;
  accept: string;
  catalog: Catalog;
  video: VideoSettings;
  onResult: (result: ActionResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { pending, run } = useAction();
  const busy = teaching.youtube_status === "uploading" || teaching.youtube_status === "processing";
  const thumb = teaching.cover || (teaching.youtube_id ? `https://i.ytimg.com/vi/${teaching.youtube_id}/mqdefault.jpg` : null);

  function remove() {
    if (!window.confirm(`¿Eliminar «${teaching.title}»? Ya no aparecerá en la web. Si tiene video en YouTube, seguirá en el canal.`)) return;
    run(() => deleteTeaching(teaching.id), onResult);
  }

  return (
    <article className="rounded-[1.5rem] border border-line bg-card p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-paper md:w-44">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tracking-[0.12em] text-muted">{teaching.file_type || "SIN VIDEO"}</span>
          )}
          {teaching.duration ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">{formatDuration(teaching.duration)}</span> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge teaching={teaching} />
            {teaching.source === "live" ? <span className="rounded-full bg-[#d61f33]/10 px-2.5 py-1 text-[11px] font-semibold text-[#b5172a]">Transmisión en vivo</span> : null}
            <span className="text-xs text-muted">
              {formatSermonDate(teaching.teaching_date)} · {teaching.kind === "gc" ? "Para los GC" : "Prédica"}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold leading-snug tracking-[-0.02em]">{teaching.title}</h2>
          {teaching.preacher ? <p className="text-sm text-muted">Predica: {teaching.preacher}</p> : null}
          {teaching.youtube_error ? (
            <p className={`mt-2 rounded-xl px-3 py-2 text-xs ${teaching.youtube_error.startsWith("Aviso") ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>{teaching.youtube_error}</p>
          ) : null}
          {teaching.youtube_status === "uploading" ? (
            <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-sky-600 transition-[width] duration-500" style={{ width: `${teaching.youtube_progress}%` }} />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={`${ghost} px-3 py-1.5 text-xs`} onClick={() => setEditing((value) => !value)}>
              {editing ? "Cerrar" : "Editar"}
            </button>
            {video.canPublish && !busy ? (
              <button
                type="button"
                className={`${ghost} px-3 py-1.5 text-xs`}
                disabled={!video.connected}
                title={video.connected ? undefined : "Conecta el canal de YouTube en Transmisión"}
                onClick={() => setPublishing(true)}
              >
                {teaching.youtube_id ? "Subir video editado" : "Publicar en YouTube"}
              </button>
            ) : null}
            {teaching.youtube_id ? (
              <a href={`https://youtu.be/${teaching.youtube_id}`} target="_blank" rel="noreferrer" className={`${ghost} px-3 py-1.5 text-xs`}>
                Ver en YouTube ↗
              </a>
            ) : null}
            {teaching.file_url ? (
              <a href={teaching.file_url} target="_blank" rel="noreferrer" className={`${ghost} px-3 py-1.5 text-xs`}>
                Ver archivo
              </a>
            ) : null}
            <button type="button" disabled={pending || teaching.youtube_status === "uploading"} onClick={remove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {teaching.recordings.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted">Grabación original · para editar reels y clips (se borra sola a los {Math.round(video.retentionHours / 24)} días)</p>
          <RecordingList recordings={teaching.recordings} />
        </div>
      ) : null}

      {editing ? (
        <div className="mt-5">
          <TeachingEditor
            teaching={teaching}
            accept={accept}
            catalog={catalog}
            onSaved={(result) => {
              setEditing(false);
              onResult(result);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : null}

      {publishing ? (
        <PublishDialog
          teaching={teaching}
          catalog={catalog}
          video={video}
          onClose={() => setPublishing(false)}
          onDone={(result) => {
            setPublishing(false);
            onResult(result);
          }}
        />
      ) : null}
    </article>
  );
}

export default function Recursos({ teachings, accept, video, catalog }: { teachings: AdminTeaching[]; accept: string; video: VideoSettings; catalog: Catalog }) {
  const site = useSiteUrl();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<ActionResult | null>(null);

  const working = teachings.some((teaching) => teaching.youtube_status === "uploading" || teaching.youtube_status === "processing" || teaching.recordings.some((recording) => recording.status === "processing"));
  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(() => {
      if (!document.hidden) router.reload({ only: ["teachings"] });
    }, 8000);
    return () => window.clearInterval(id);
  }, [working]);

  const filters: { id: Filter; label: string; test: (teaching: AdminTeaching) => boolean }[] = [
    { id: "all", label: "Todas", test: () => true },
    { id: "site", label: "En la web", test: (teaching) => teaching.on_site },
    { id: "hidden", label: "No visibles", test: (teaching) => !teaching.on_site },
    { id: "predica", label: "Prédica", test: (teaching) => teaching.kind === "predica" },
    { id: "gc", label: "GC", test: (teaching) => teaching.kind === "gc" },
  ];
  const needle = fold(query.trim());
  const test = filters.find((item) => item.id === filter)?.test ?? (() => true);
  const shown = teachings.filter((teaching) => test(teaching) && (!needle || fold(`${teaching.title} ${teaching.preacher ?? ""}`).includes(needle)));

  function done(result: ActionResult) {
    setNotice(result);
    setCreating(false);
  }

  return (
    <AdminLayout>
      <PageHeader
        kicker="Página web"
        title="Enseñanzas"
        text="Cada prédica de la iglesia. Las transmisiones en vivo llegan aquí solas al terminar. Una enseñanza se muestra en la web cuando tiene su video de YouTube (público o no listado) o un archivo para descargar; la más reciente aparece en grande."
        aside={
          <div className="flex flex-wrap gap-2">
            <a href={`${site}/recursos`} target="_blank" rel="noreferrer" className={ghost}>
              Ver en la web ↗
            </a>
            {!creating ? (
              <button type="button" className={button} onClick={() => setCreating(true)}>
                + Nueva enseñanza
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-4">
        <Notice result={notice} onClose={() => setNotice(null)} />
        {video.canPublish && !video.connected ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Para publicar videos en YouTube desde aquí, conecta primero el canal de la iglesia en Transmisión.</p>
        ) : null}

        {creating ? (
          <section className="rounded-[1.5rem] border border-line bg-card p-5">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Nueva enseñanza</h2>
            <p className="mt-1 text-xs text-muted">Guárdala ahora; después puedes publicar su video en YouTube con el botón «Publicar en YouTube».</p>
            <div className="mt-4">
              <TeachingEditor accept={accept} catalog={catalog} onSaved={done} onCancel={() => setCreating(false)} />
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full border px-4 py-1.5 ${filter === item.id ? "border-ink bg-ink text-paper" : "border-line bg-white"}`}
              >
                {item.label} ({teachings.filter(item.test).length})
              </button>
            ))}
          </div>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o predicador" className={`${input} mt-0 max-w-xs`} />
        </div>

        {shown.length ? (
          <div className="grid gap-4">
            {shown.map((teaching) => (
              <TeachingRow key={teaching.id} teaching={teaching} accept={accept} catalog={catalog} video={video} onResult={setNotice} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">Aún no hay enseñanzas en esta lista.</p>
        )}
      </div>
    </AdminLayout>
  );
}

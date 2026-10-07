import { useState } from "react";
import type { AdminSermon } from "@/Components/admin/sermons/types";
import { button, ghost, input } from "@/Components/admin/ui";
import { send, type ActionResult } from "@/lib/actions";
import { formatViews, videoClock, videoThumbnail, youtubeId } from "@/lib/youtube";

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{children}</span>;
}

/** A sermon the panel edits; the ones waiting for review get publish/discard buttons. */
export function SermonRow({ sermon, onResult }: { sermon: AdminSermon; onResult: (result: ActionResult) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const video = youtubeId(sermon.youtube_id);
  const thumb = videoThumbnail(sermon);
  const clock = videoClock(sermon.duration);

  async function act(task: () => Promise<ActionResult>) {
    setBusy(true);
    onResult(await task());
    setBusy(false);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    act(() => send("/admin/predicas", new FormData(event.currentTarget)));
  }

  function remove() {
    const note = sermon.youtube_id ? " El buscador automático no la volverá a traer." : "";
    if (window.confirm(`¿Eliminar «${sermon.title}» de la página?${note}`)) {
      act(() => send("/admin/predicas/eliminar", { id: sermon.id }));
    }
  }

  return (
    <article className={`rounded-[1.4rem] border bg-white p-4 transition ${sermon.pending ? "border-amber-300 ring-4 ring-amber-100" : "border-line"}`}>
      <div className="grid gap-4 md:grid-cols-[200px_1fr_auto] md:items-center">
        <a
          href={video ? `https://www.youtube.com/watch?v=${video}` : undefined}
          target="_blank"
          rel="noreferrer"
          className="relative block aspect-video overflow-hidden rounded-xl bg-paper"
        >
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs text-muted">Sin video</span>}
          {clock ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">{clock}</span> : null}
        </a>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {sermon.pending ? (
              <Badge tone="bg-amber-100 text-amber-900">Por revisar</Badge>
            ) : sermon.published ? (
              <Badge tone="bg-emerald-50 text-emerald-800">En la página</Badge>
            ) : (
              <Badge tone="bg-ink/8 text-ink">Oculta</Badge>
            )}
            <Badge tone={sermon.source === "youtube" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-800"}>
              {sermon.source === "youtube" ? "Desde YouTube" : "Agregada a mano"}
            </Badge>
            {sermon.series ? <Badge tone="bg-paper text-muted">{sermon.series}</Badge> : null}
          </div>
          <p className="mt-2 truncate text-[15px] font-semibold">{sermon.title}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {[sermon.sermon_date, formatViews(sermon.views), sermon.preacher].filter(Boolean).join(" · ")}
          </p>
          {sermon.title_locked && sermon.youtube_title ? (
            <p className="mt-1 truncate text-[12px] text-muted">En YouTube: «{sermon.youtube_title}»</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {sermon.pending ? (
            <>
              <button type="button" className={button} disabled={busy} onClick={() => act(() => send("/admin/predicas/revisar", { action: "approve", ids: [sermon.id] }))}>
                Publicar
              </button>
              <button type="button" className={ghost} disabled={busy} onClick={() => act(() => send("/admin/predicas/revisar", { action: "discard", ids: [sermon.id] }))}>
                Descartar
              </button>
            </>
          ) : null}
          <button type="button" className={ghost} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? "Cerrar" : "Editar"}
          </button>
        </div>
      </div>

      {open ? (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-2">
          <input type="hidden" name="id" value={sermon.id} />
          <label className="text-xs font-semibold text-muted md:col-span-2">
            Título
            <input name="title" defaultValue={sermon.title} required className={input} />
            {sermon.title_locked && sermon.youtube_title ? (
              <span className="mt-1 flex items-center gap-2 font-normal">
                <input type="checkbox" name="restore_title" value="1" /> Volver a usar el título de YouTube (se actualizará solo si lo cambian allá)
              </span>
            ) : sermon.youtube_title ? (
              <span className="mt-1 block font-normal">Si lo cambias, se mantendrá tu título aunque cambie en YouTube.</span>
            ) : null}
          </label>
          <label className="text-xs font-semibold text-muted">
            Predicador
            <input name="preacher" defaultValue={sermon.preacher || ""} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Serie
            <input name="series" defaultValue={sermon.series || ""} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Fecha del culto
            <input name="sermon_date" type="date" defaultValue={sermon.sermon_date || ""} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Enlace o ID de YouTube
            <input name="youtube_id" defaultValue={sermon.youtube_id || ""} className={input} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="published" value="1" defaultChecked={sermon.published || sermon.pending} /> Mostrar en la página
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={remove} className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" disabled={busy}>
              Eliminar
            </button>
            <button className={button} disabled={busy}>
              Guardar
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

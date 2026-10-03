import { useMemo, useState } from "react";
import { Notice, button, ghost, input, useAction } from "@/Components/admin/ui";
import { RadioHeader } from "@/Components/radio/admin-ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send } from "@/lib/actions";
import { duration, longDuration, type Autopilot, type RadioPlaylist, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Props = { playlists: RadioPlaylist[]; songs: RadioTrack[]; autopilot: Autopilot };

type Draft = { id: string | null; name: string; description: string; tracks: string[] };

const blank: Draft = { id: null, name: "", description: "", tracks: [] };

function draftOf(playlist: RadioPlaylist): Draft {
  return { id: playlist.id, name: playlist.name, description: playlist.description ?? "", tracks: playlist.tracks ?? [] };
}

/** Playlists of the automatic music: songs in order, and the order of the lists. */
export default function Listas({ playlists, songs, autopilot }: Props) {
  const [draft, setDraft] = useState<Draft>(() => (playlists[0] ? draftOf(playlists[0]) : blank));
  const [query, setQuery] = useState("");
  const { result, setResult, pending, run } = useAction();
  const byId = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const picked = draft.tracks.map((id) => byId.get(id)).filter((song): song is RadioTrack => Boolean(song));
  const inList = new Set(draft.tracks);
  const shown = songs.filter((song) => !inList.has(song.id) && `${song.title} ${song.artist ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const length = picked.reduce((sum, song) => sum + song.duration, 0);
  const saved = playlists.find((item) => item.id === draft.id);
  const changed = !saved || draft.name !== saved.name || draft.description !== (saved.description ?? "") || draft.tracks.join() !== (saved.tracks ?? []).join();

  function edit(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function move(index: number, by: number) {
    const tracks = [...draft.tracks];
    const [item] = tracks.splice(index, 1);
    tracks.splice(Math.max(0, Math.min(tracks.length, index + by)), 0, item);
    edit({ tracks });
  }

  function open(playlist: RadioPlaylist | null) {
    if (changed && draft.name && !window.confirm("Hay cambios sin guardar en esta lista. ¿Descartarlos?")) return;
    setResult(null);
    setDraft(playlist ? draftOf(playlist) : blank);
  }

  function save() {
    run(
      () => send("/admin/radio/listas", { id: draft.id ?? "", name: draft.name, description: draft.description, tracks: draft.tracks.length ? draft.tracks : [""] }),
      (data) => {
        const id = (data as { id?: string }).id;
        if (id) edit({ id });
      },
    );
  }

  function remove() {
    if (!draft.id || !window.confirm(`¿Eliminar la lista «${draft.name}»? Las canciones siguen en la biblioteca.`)) return;
    run(
      () => send("/admin/radio/listas/eliminar", { id: draft.id ?? "" }),
      () => setDraft(blank),
    );
  }

  function reorder(index: number, by: number) {
    const ids = playlists.map((item) => item.id);
    const [item] = ids.splice(index, 1);
    ids.splice(Math.max(0, Math.min(ids.length, index + by)), 0, item);
    run(() => send("/admin/radio/listas/orden", { ids }));
  }

  return (
    <AdminLayout>
      <RadioHeader
        title="Listas de reproducción"
        text="Agrupa tus canciones en listas (Alabanza, Adoración, Instrumental…). La música automática toca una lista (en aleatorio sin repetir hasta completar cada vuelta, o en el orden que le des aquí) o canciones aleatorias de todas."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="rounded-[1.6rem] border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Tus listas</p>
              <button type="button" onClick={() => open(null)} className={`${ghost} !px-3 !py-1.5 text-xs`}>+ Nueva lista</button>
            </div>
            {playlists.length ? (
              <ol className="mt-3 space-y-1.5">
                {playlists.map((item, index) => {
                  const active = item.id === draft.id;
                  return (
                    <li key={item.id} className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition ${active ? "border-ink bg-white" : "border-transparent bg-white/60 hover:border-line"}`}>
                      <button type="button" onClick={() => open(item)} className="min-w-0 flex-1 text-left">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{item.name}</span>
                          {autopilot.playlist === item.id ? <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">Piloto automático</span> : null}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {item.count} {item.count === 1 ? "canción" : "canciones"} · {longDuration(item.seconds)}
                        </span>
                      </button>
                      <span className="flex flex-col">
                        <button type="button" disabled={pending || index === 0} onClick={() => reorder(index, -1)} className="px-1 text-[11px] text-muted hover:text-ink disabled:opacity-30" aria-label="Subir">▲</button>
                        <button type="button" disabled={pending || index === playlists.length - 1} onClick={() => reorder(index, 1)} className="px-1 text-[11px] text-muted hover:text-ink disabled:opacity-30" aria-label="Bajar">▼</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">Aún no hay listas. Crea la primera a la derecha.</p>
            )}
          </section>
          <p className="px-2 text-[12px] leading-5 text-muted">
            Ahora suena en los espacios libres: <strong className="text-ink">{autopilot.label}</strong>
            {autopilot.playlist ? ` · ${autopilot.shuffle ? "aleatorio" : "en orden"}` : ""}. Se cambia en Programación o desde la consola.
          </p>
        </aside>

        <section className="min-w-0 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <label className="text-xs font-semibold text-muted">
              Nombre de la lista
              <input value={draft.name} onChange={(event) => edit({ name: event.target.value })} maxLength={80} placeholder="Ej.: Alabanza" className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Descripción (opcional)
              <input value={draft.description} onChange={(event) => edit({ description: event.target.value })} maxLength={240} placeholder="Ej.: Para las mañanas" className={input} />
            </label>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-muted">En esta lista ({picked.length})</p>
                <p className="font-mono text-[11px] text-muted">{longDuration(length)} por vuelta</p>
              </div>
              {picked.length ? (
                <ol className="mt-2 max-h-[28rem] space-y-1 overflow-y-auto pr-1">
                  {picked.map((song, index) => (
                    <li key={song.id} className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-[13px]">
                      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {song.title}
                        {song.artist ? <span className="text-muted"> · {song.artist}</span> : null}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{duration(song.duration)}</span>
                      <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="px-0.5 text-[11px] text-muted hover:text-ink disabled:opacity-30" aria-label="Subir">▲</button>
                      <button type="button" disabled={index === picked.length - 1} onClick={() => move(index, 1)} className="px-0.5 text-[11px] text-muted hover:text-ink disabled:opacity-30" aria-label="Bajar">▼</button>
                      <button type="button" onClick={() => edit({ tracks: draft.tracks.filter((id) => id !== song.id) })} className="px-1 text-muted hover:text-red-700" aria-label="Quitar">×</button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-muted">Toca las canciones de la biblioteca para agregarlas en orden.</p>
              )}
              {picked.length === 1 ? <p className="mt-2 text-xs font-medium text-amber-800">Con una sola canción, sonará una y otra vez.</p> : null}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en la biblioteca…" className={`${input} !mt-0`} />
                <button type="button" disabled={!shown.length} onClick={() => edit({ tracks: [...draft.tracks, ...shown.map((song) => song.id)] })} className="shrink-0 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40">
                  Agregar {query.trim() ? "estas" : "todas"}
                </button>
              </div>
              {songs.length ? (
                <ul className="mt-2 max-h-[28rem] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white">
                  {shown.map((song) => (
                    <li key={song.id}>
                      <button type="button" onClick={() => edit({ tracks: [...draft.tracks, song.id] })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-paper">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-bold">+</span>
                        <span className="min-w-0 flex-1 truncate">
                          {song.title}
                          {song.artist ? <span className="text-muted"> · {song.artist}</span> : null}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted">{duration(song.duration)}</span>
                      </button>
                    </li>
                  ))}
                  {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted">{query ? "Sin resultados." : "Todas las canciones ya están en la lista."}</li> : null}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                  La biblioteca no tiene canciones. <a href="/admin/radio/biblioteca" className="font-semibold text-ink underline">Súbelas aquí</a>.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <Notice result={result} onClose={() => setResult(null)} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={pending || draft.name.trim().length < 2 || !changed} onClick={save} className={button}>
                {pending ? "Guardando…" : draft.id ? "Guardar lista" : "Crear lista"}
              </button>
              {draft.id ? (
                <button type="button" disabled={pending} onClick={remove} className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                  Eliminar lista
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

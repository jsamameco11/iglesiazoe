import { useState } from "react";
import { Notice, button, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { duration, longDuration, type RadioTrack } from "@/lib/radio";

/** Chooses the songs that fill the gaps of the main program (the continuous music), mixed with the crossfade. */
export function RotationPanel({ tracks, autofill, crossfade }: { tracks: RadioTrack[]; autofill: boolean; crossfade: number }) {
  const songs = tracks.filter((track) => track.kind === "musica");
  const [chosen, setChosen] = useState(() => new Set(songs.filter((track) => track.rotation).map((track) => track.id)));
  const [query, setQuery] = useState("");
  const { result, setResult, pending, run } = useAction();
  const shown = songs.filter((track) => `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const length = songs.filter((track) => chosen.has(track.id)).reduce((sum, track) => sum + track.duration, 0);
  const changed = songs.some((track) => track.rotation !== chosen.has(track.id));

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  }

  function save() {
    run(() => send("/admin/radio/programacion/rotacion", { tracks: chosen.size ? [...chosen] : [""] }));
  }

  return (
    <section className="rounded-[1.6rem] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Música continua</p>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">
        Solo las canciones marcadas se repiten: llenan los espacios libres de la pista principal, en orden variado y empalmadas {crossfade ? `${crossfade} s` : "sin fundido"}.
        {autofill ? "" : " Ahora está en pausa."}
      </p>
      {songs.length ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canción…" className={`${input} !mt-0`} />
            <button type="button" onClick={() => setChosen(new Set(songs.map((track) => track.id)))} className="shrink-0 text-xs font-semibold text-muted hover:text-ink">Todas</button>
            <button type="button" onClick={() => setChosen(new Set())} className="shrink-0 text-xs font-semibold text-muted hover:text-ink">Ninguna</button>
          </div>
          <ul className="mt-2 max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white">
            {shown.map((track) => (
              <li key={track.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-paper">
                  <input type="checkbox" checked={chosen.has(track.id)} onChange={() => toggle(track.id)} />
                  <span className="min-w-0 flex-1 truncate">
                    {track.title}
                    {track.artist ? <span className="text-muted"> · {track.artist}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">{duration(track.duration)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            {chosen.size} de {songs.length} canciones · {longDuration(length)} antes de repetir
          </p>
          {chosen.size === 1 ? <p className="mt-1 text-xs font-medium text-amber-800">Con una sola canción, sonará una y otra vez sin parar.</p> : null}
          <Notice result={result} onClose={() => setResult(null)} />
          <button type="button" disabled={pending || !changed} onClick={save} className={`${button} mt-3 w-full`}>
            {pending ? "Guardando…" : "Guardar música continua"}
          </button>
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Aún no hay canciones. <a href="/admin/radio/biblioteca" className="font-semibold text-ink underline">Súbelas a la biblioteca</a> y elígelas aquí.
        </p>
      )}
    </section>
  );
}

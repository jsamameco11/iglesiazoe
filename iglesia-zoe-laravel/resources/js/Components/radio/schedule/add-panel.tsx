import { useState, type FormEvent } from "react";
import { Notice, button, input, useAction } from "@/Components/admin/ui";
import { KindTag } from "@/Components/radio/admin-ui";
import { DuckIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { KIND_LABEL, LAYERS, clock, duration, layerLabel, type RadioTrack } from "@/lib/radio";

type Mode = "end" | "at" | "now";

/** Places library audios (or a live block) on a layer of the day: after the last block, at an exact time or right now. */
export function AddPanel({ date, isToday, dayEnds, tracks }: { date: string; isToday: boolean; dayEnds: Record<number, number | null>; tracks: RadioTrack[] }) {
  const [type, setType] = useState<"tracks" | "vivo">("tracks");
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<Mode>("end");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("");
  const [picked, setPicked] = useState<RadioTrack[]>([]);
  const [volume, setVolume] = useState(100);
  const [duck, setDuck] = useState<"" | "1" | "0">("");
  const { result, setResult, pending, run } = useAction();
  const overlay = type === "tracks" && layer > 0;
  const dayEnd = dayEnds[type === "vivo" ? 0 : layer] ?? null;

  const shown = tracks.filter((track) => (!kind || track.kind === kind) && `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60);
  const length = type === "tracks" ? picked.reduce((sum, track) => sum + track.duration, 0) : 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("date", date);
    data.set("mode", mode);
    data.set("type", type);
    data.set("layer", String(type === "vivo" ? 0 : layer));
    if (overlay) {
      data.set("volume", String(volume));
      data.set("duck", duck);
    }
    if (type === "tracks") picked.forEach((track) => data.append("tracks[]", track.id));
    run(
      () => send("/admin/radio/programacion", data),
      () => setPicked([]),
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[1.6rem] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Agregar a la programación</p>
      <div className="mt-3 flex rounded-full bg-paper p-1">
        {(
          [
            ["tracks", "Desde la biblioteca"],
            ["vivo", "Bloque en vivo"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setType(value)} className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${type === value ? "bg-ink text-white" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      {type === "tracks" ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted">¿En qué pista?</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-xl bg-paper p-1">
            {LAYERS.map((value) => (
              <button key={value} type="button" onClick={() => setLayer(value)} className={`rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition ${layer === value ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
                {value === 0 ? "Principal" : layerLabel(value)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] leading-4 text-muted">
            {overlay ? "Suena encima de la pista principal, sin cortarla: ideal para anuncios, cortinas y efectos sobre la música." : "La pista principal lleva el programa: canciones, programas grabados y bloques en vivo, uno tras otro."}
          </p>

          {tracks.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
              La biblioteca está vacía. <a href="/admin/radio/biblioteca" className="font-semibold text-ink underline">Sube tus audios</a> primero.
            </p>
          ) : (
            <>
              <div className="mt-4 flex gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" className={`${input} !mt-0`} />
                <select value={kind} onChange={(event) => setKind(event.target.value)} className={`${input} !mt-0 !w-auto`}>
                  <option value="">Todo</option>
                  {(["musica", "anuncio", "efecto", "programa"] as const).map((value) => (
                    <option key={value} value={value}>{KIND_LABEL[value]}</option>
                  ))}
                </select>
              </div>
              <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white">
                {shown.map((track) => (
                  <li key={track.id}>
                    <button type="button" onClick={() => setPicked((list) => [...list, track])} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-paper">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-bold">+</span>
                      <span className="min-w-0 flex-1 truncate">
                        {track.title}
                        {track.artist ? <span className="text-muted"> · {track.artist}</span> : null}
                      </span>
                      {track.duck ? <DuckIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" /> : null}
                      <span className="shrink-0 font-mono text-[11px] text-muted">{duration(track.duration)}</span>
                    </button>
                  </li>
                ))}
                {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted">Sin resultados.</li> : null}
              </ul>
              <p className="mt-4 text-xs font-semibold text-muted">En este orden ({picked.length})</p>
              {picked.length ? (
                <ol className="mt-1.5 space-y-1">
                  {picked.map((track, index) => (
                    <li key={`${track.id}-${index}`} className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-[13px]">
                      <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted">{index + 1}</span>
                      <KindTag kind={track.kind} />
                      <span className="min-w-0 flex-1 truncate">{track.title}</span>
                      <button type="button" onClick={() => setPicked((list) => list.filter((_, at) => at !== index))} className="px-1 text-muted hover:text-red-700" aria-label="Quitar">
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1.5 rounded-lg border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">Toca los audios de arriba para ponerlos en fila.</p>
              )}
              {picked.length ? <p className="mt-2 text-xs text-muted">Duración total: {duration(length)}</p> : null}
            </>
          )}

          {overlay ? (
            <div className="mt-4 space-y-3 rounded-xl border border-line bg-white p-3">
              <label className="block text-xs font-semibold text-muted">
                Volumen de la capa: {volume}%
                <input type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="mt-2 w-full accent-ink" />
              </label>
              <label className="block text-xs font-semibold text-muted">
                Mientras suena, la música de la pista principal…
                <select value={duck} onChange={(event) => setDuck(event.target.value as "" | "1" | "0")} className={input}>
                  <option value="">Según cada audio (lo marcado en la biblioteca)</option>
                  <option value="1">Baja para que se escuche mejor</option>
                  <option value="0">Sigue igual</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-semibold text-muted">
            Nombre del bloque
            <input name="title" maxLength={160} placeholder="Ej.: Mañanas con Zoe" className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Duración (minutos)
            <input name="minutes" type="number" min={1} max={360} defaultValue={30} className={input} />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="bed" value="1" defaultChecked className="mt-1" />
            <span>
              Música de fondo
              <span className="block text-xs text-muted">Durante el bloque suena la música continua bajita, lista para tu voz.</span>
            </span>
          </label>
        </div>
      )}

      <label className="mt-4 block text-xs font-semibold text-muted">
        Nota interna (opcional)
        <input name="note" maxLength={240} className={input} placeholder="Solo la ve el equipo" />
      </label>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs font-semibold text-muted">¿Cuándo suena?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === "end"} onChange={() => setMode("end")} />
          {dayEnd ? `Después del último bloque de la ${overlay ? layerLabel(layer).toLowerCase() : "pista"} (${clock(dayEnd, true)})` : "Al inicio del día, a esta hora:"}
        </label>
        {mode === "end" && !dayEnd ? <input name="time" type="time" step={1} defaultValue="06:00:00" className={`${input} ml-6 !w-40`} /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === "at"} onChange={() => setMode("at")} /> A una hora exacta
        </label>
        {mode === "at" ? <input name="time" type="time" step={1} required className={`${input} ml-6 !w-40`} /> : null}
        {isToday ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} className="mt-1" />
            <span>
              {overlay ? "Ahora mismo, encima" : "Al aire ahora"}
              <span className="block text-xs text-muted">{overlay ? "Suena en segundos sobre lo que está al aire, sin cortarlo." : "Corta lo que suena y corre lo que sigue para darle espacio."}</span>
            </span>
          </label>
        ) : null}
      </fieldset>

      <div className="mt-4">
        <Notice result={result} onClose={() => setResult(null)} />
      </div>
      <button disabled={pending || (type === "tracks" && picked.length === 0)} className={`${button} mt-3 w-full`}>
        {pending ? "Programando…" : mode === "now" ? "Lanzar al aire" : "Programar"}
      </button>
    </form>
  );
}

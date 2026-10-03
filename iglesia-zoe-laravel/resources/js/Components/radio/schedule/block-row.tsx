import { useState, type FormEvent } from "react";
import { Notice, button, input, useAction } from "@/Components/admin/ui";
import { KindTag } from "@/Components/radio/admin-ui";
import { DuckIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { SourcePicker } from "@/Components/radio/source-picker";
import { LAYERS, clock, duration, layerLabel, type RadioBlock, type RadioPlaylist } from "@/lib/radio";

/** One block of the timeline: details, preview, edit (time, layer, volume, music lowering, playlist) and remove. */
export function BlockRow({
  block,
  date,
  now,
  editing,
  previewing,
  playlists,
  onEdit,
  onPreview,
}: {
  block: RadioBlock;
  date: string;
  now: number;
  editing: boolean;
  previewing: boolean;
  playlists: RadioPlaylist[];
  onEdit: () => void;
  onPreview: () => void;
}) {
  const { result, setResult, pending, run } = useAction();
  const [layer, setLayer] = useState(block.layer);
  const [volume, setVolume] = useState(block.volume);
  const [playlist, setPlaylist] = useState(block.playlist_id ?? "");
  const [shuffle, setShuffle] = useState(block.shuffle);
  const isNow = block.start <= now && now < block.end;
  const past = block.end <= now;
  const overlay = block.layer > 0;
  const auto = block.kind === "automatica";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", block.id);
    data.set("date", date);
    if (auto) {
      data.set("playlist", playlist);
      data.set("shuffle", shuffle ? "1" : "0");
    } else if (block.kind !== "vivo") {
      data.set("layer", String(layer));
      if (!data.has("duck")) data.set("duck", "0");
    }
    run(() => send("/admin/radio/programacion/editar", data), onEdit);
  }

  function remove() {
    if (!window.confirm(`¿Quitar «${block.title}» de la programación?`)) return;
    run(() => send("/admin/radio/programacion/quitar", { id: block.id }));
  }

  return (
    <div id={`bloque-${block.id}`} className="tl-item scroll-mt-24 py-1.5" data-now={isNow || undefined} data-overlay={overlay || undefined}>
      <p className={`pt-3 text-right font-mono text-[13px] font-semibold tabular-nums ${past ? "text-muted" : "text-ink"}`}>
        {clock(block.start, true)}
        <span className="block text-[11px] font-normal text-muted">{clock(block.end, true)}</span>
      </p>
      <span className={`tl-dot tl-kind-${block.kind}`} />
      <div className={`tl-card ml-6 rounded-2xl border p-3.5 transition ${isNow ? "border-red-300 bg-red-50/60" : "border-line bg-white"} ${past ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {overlay ? <span className="tl-layer-tag">{layerLabel(block.layer)} · encima</span> : null}
              <KindTag kind={block.kind} />
              {isNow ? <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-red-600">Al aire</span> : null}
              {block.kind === "vivo" && block.bed ? <span className="text-[11px] text-muted">con música de fondo</span> : null}
              {block.kind === "vivo" ? <span className="text-[11px] text-muted">si nadie se conecta, sigue la música automática</span> : null}
              {overlay && block.duck ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <DuckIcon className="h-3.5 w-3.5" /> baja la música
                </span>
              ) : null}
              {overlay && block.volume !== 100 ? <span className="text-[11px] text-muted">volumen {block.volume}%</span> : null}
              {block.inactive ? <span className="text-[11px] font-semibold text-amber-700">Audio desactivado: no sonará</span> : null}
            </div>
            <p className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.01em]">{block.title}</p>
            <p className="truncate text-[12.5px] text-muted">
              {duration(block.duration)}
              {block.artist ? ` · ${block.artist}` : ""}
              {block.note ? ` · ${block.note}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {block.src ? (
              <button type="button" onClick={onPreview} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink" aria-label="Escuchar">
                {previewing ? "■ Parar" : "▶ Oír"}
              </button>
            ) : null}
            <button type="button" onClick={onEdit} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">
              {editing ? "Cerrar" : "Editar"}
            </button>
            <button type="button" disabled={pending} onClick={remove} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">
              Quitar
            </button>
          </div>
        </div>
        {editing ? (
          <form onSubmit={save} className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Hora de inicio
              <input name="time" type="time" step={1} defaultValue={clock(block.start, true)} className={input} />
            </label>
            {auto ? (
              <label className="text-xs font-semibold text-muted">
                Hasta las
                <input name="until" type="time" step={1} defaultValue={clock(block.end, true)} className={input} />
              </label>
            ) : (
              <label className="text-xs font-semibold text-muted">
                Título
                <input name="title" defaultValue={block.title} maxLength={160} className={input} />
              </label>
            )}
            {auto ? (
              <div className="sm:col-span-2">
                <SourcePicker playlists={playlists} playlist={playlist} shuffle={shuffle} onPlaylist={setPlaylist} onShuffle={setShuffle} />
              </div>
            ) : block.kind === "vivo" ? (
              <>
                <label className="text-xs font-semibold text-muted">
                  Duración (minutos)
                  <input name="minutes" type="number" min={1} max={360} step={1} defaultValue={Math.round(block.duration / 60)} className={input} />
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm text-ink">
                  <input type="checkbox" name="bed" value="1" defaultChecked={block.bed} /> Música de fondo
                </label>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold text-muted">
                  Pista
                  <select value={layer} onChange={(event) => setLayer(Number(event.target.value))} className={input}>
                    {LAYERS.map((value) => (
                      <option key={value} value={value}>{value === 0 ? "Pista principal" : `${layerLabel(value)} (encima)`}</option>
                    ))}
                  </select>
                </label>
                {layer > 0 ? (
                  <>
                    <label className="text-xs font-semibold text-muted">
                      Volumen: {volume}%
                      <input name="volume" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="mt-3 w-full accent-ink" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
                      <input type="checkbox" name="duck" value="1" defaultChecked={block.duck} /> Bajar la música de la pista principal mientras suena
                    </label>
                  </>
                ) : null}
              </>
            )}
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Nota interna (opcional)
              <input name="note" defaultValue={block.note ?? ""} maxLength={240} className={input} placeholder="Ej.: leer el anuncio del retiro al terminar" />
            </label>
            <div className="sm:col-span-2">
              <Notice result={result} onClose={() => setResult(null)} />
              <button disabled={pending} className={`${button} mt-2`}>{pending ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </form>
        ) : result?.error ? (
          <div className="mt-3">
            <Notice result={result} onClose={() => setResult(null)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

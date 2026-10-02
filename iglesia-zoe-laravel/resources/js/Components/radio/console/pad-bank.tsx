import { Link } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { DuckIcon, StopIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { KIND_LABEL, duration, shortTitle, type RadioTrack } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

const MAX_PADS = 16;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/** The effects bank: one button per chosen audio, played on top of the program for every listener. */
export function PadBank({ api, initial, library }: { api: ConsoleApi; initial: RadioTrack[]; library: RadioTrack[] }) {
  const { state, now, layerAction } = api;
  const [pads, setPads] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [fired, setFired] = useState<string | null>(null);
  const sounding = state.layers.filter((layer) => layer.lane === "pad" && layer.start <= now && now < layer.end);

  function fire(track: RadioTrack) {
    setFired(track.id);
    window.setTimeout(() => setFired((value) => (value === track.id ? null : value)), 650);
    void layerAction({ action: "play", id: track.id, lane: "pad" });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (picking || event.ctrlKey || event.metaKey || event.altKey || target?.closest("input, select, textarea, [contenteditable]")) return;
      const index = KEYS.indexOf(event.key);
      if (index >= 0 && pads[index]) {
        event.preventDefault();
        fire(pads[index]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="studio-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="studio-label">Efectos · botonera</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPicking(true)} className="studio-btn !w-auto !py-1.5" data-on="blue">Elegir efectos</button>
          <button type="button" disabled={!sounding.length} onClick={() => layerAction({ action: "stop", lane: "pad" })} className="studio-btn !w-auto !py-1.5">
            <StopIcon className="h-3 w-3" /> Detener
          </button>
        </div>
      </div>

      {pads.length ? (
        <div className="studio-pads mt-3">
          {pads.map((pad, index) => {
            const playing = sounding.filter((layer) => layer.track_id === pad.id).at(-1);
            return (
              <button
                key={pad.id}
                type="button"
                onClick={() => fire(pad)}
                className="studio-pad"
                data-kind={pad.kind}
                data-fired={fired === pad.id || undefined}
                data-playing={playing ? "" : undefined}
                title={pad.title}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">{shortTitle(pad.title, 30)}</span>
                  {index < KEYS.length ? <kbd className="pad-key">{KEYS[index]}</kbd> : null}
                </span>
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  {KIND_LABEL[pad.kind]} · {playing ? `-${duration((playing.end - now) / 1000)}` : duration(pad.duration)}
                  {pad.duck ? <DuckIcon className="h-3 w-3" /> : null}
                </span>
                {playing ? <span className="pad-bar" style={{ width: `${Math.min(100, ((now - playing.start) / Math.max(1, playing.end - playing.start)) * 100)}%` }} /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/45">
          La botonera está vacía. Usa «Elegir efectos» para poner tus efectos, cortinas y anuncios a un clic.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-4 text-white/40">
        Suenan encima de la música para todos. Teclas 1–0 para los diez primeros. <DuckIcon className="inline h-3 w-3" /> baja la música mientras suena.
      </p>

      {picking ? <PadPicker library={library} chosen={pads} onClose={() => setPicking(false)} onSaved={setPads} /> : null}
    </div>
  );
}

const FILTERS = [
  { id: "", label: "Todos" },
  { id: "efecto", label: "Efectos" },
  { id: "anuncio", label: "Anuncios" },
  { id: "musica", label: "Música" },
  { id: "programa", label: "Programas" },
] as const;

function PadPicker({ library, chosen, onClose, onSaved }: { library: RadioTrack[]; chosen: RadioTrack[]; onClose: () => void; onSaved: (pads: RadioTrack[]) => void }) {
  const [selected, setSelected] = useState(chosen.map((track) => track.id));
  const [filter, setFilter] = useState<string>("efecto");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const byId = useMemo(() => new Map(library.map((track) => [track.id, track])), [library]);
  const visible = library.filter((track) => (!filter || track.kind === filter) && (!query || `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(query.toLowerCase())));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      setError("");
      setSelected(selected.filter((item) => item !== id));
    } else if (selected.length >= MAX_PADS) {
      setError(`La botonera tiene hasta ${MAX_PADS} botones.`);
    } else {
      setError("");
      setSelected([...selected, id]);
    }
  }

  function move(index: number, step: number) {
    setSelected((list) => {
      const next = [...list];
      const target = index + step;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const result = await send("/admin/radio/botonera", { tracks: selected.length ? selected : [""] });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved((result.pads as RadioTrack[]) ?? []);
    onClose();
  }

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="Elegir efectos de la botonera" onClick={onClose}>
      <div className="picker" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="studio-label">Botonera</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">Elegir efectos</h2>
            <p className="mt-1 text-[13px] text-white/50">Marca hasta {MAX_PADS} audios de la biblioteca. El orden de la derecha es el de los botones.</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-white/50 hover:text-white" aria-label="Cerrar">×</button>
        </div>

        <div className="mt-4 grid min-h-0 flex-1 gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <button key={item.id} type="button" onClick={() => setFilter(item.id)} className="picker-tab" data-on={filter === item.id || undefined}>{item.label}</button>
              ))}
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre…" className="picker-input mt-2" />
            <ul className="picker-list mt-2">
              {visible.length ? (
                visible.map((track) => {
                  const position = selected.indexOf(track.id);
                  return (
                    <li key={track.id}>
                      <button type="button" onClick={() => toggle(track.id)} className="picker-row" data-on={position >= 0 || undefined}>
                        <span className="picker-check">{position >= 0 ? position + 1 : ""}</span>
                        <span className="min-w-0 flex-1 truncate">{track.title}</span>
                        <span className="shrink-0 text-[11px] text-white/40">{KIND_LABEL[track.kind]} · {duration(track.duration)}</span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-6 text-center text-sm text-white/40">
                  No hay audios con ese filtro. <Link href="/admin/radio/biblioteca" className="underline">Súbelos en la Biblioteca</Link>.
                </li>
              )}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col">
            <p className="text-[12px] font-semibold text-white/60">En la botonera ({selected.length}/{MAX_PADS})</p>
            <ol className="picker-list mt-2">
              {selected.map((id, index) => {
                const track = byId.get(id);
                if (!track) return null;
                return (
                  <li key={id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-white/85">
                    <span className="w-5 text-right font-mono text-[11px] text-white/40">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{shortTitle(track.title, 28)}</span>
                    <button type="button" onClick={() => move(index, -1)} className="picker-mini" aria-label="Subir">↑</button>
                    <button type="button" onClick={() => move(index, 1)} className="picker-mini" aria-label="Bajar">↓</button>
                    <button type="button" onClick={() => toggle(id)} className="picker-mini" aria-label="Quitar">×</button>
                  </li>
                );
              })}
              {!selected.length ? <li className="px-3 py-6 text-center text-sm text-white/40">Aún no elegiste ninguno.</li> : null}
            </ol>
          </div>
        </div>

        {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="studio-btn !w-auto">Cancelar</button>
          <button type="button" disabled={saving} onClick={save} className="studio-btn !w-auto" data-on="green">{saving ? "Guardando…" : "Guardar botonera"}</button>
        </div>
      </div>
    </div>
  );
}

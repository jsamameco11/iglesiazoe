import { Link } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { HeadphonesIcon, StopIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { BEDS, KIND_LABEL, PLAYERS, duration, type RadioTrack } from "@/lib/radio";
import { dragTrack } from "./drag";
import type { ConsoleApi } from "./use-console";

const FILTERS = [
  { id: "", label: "Todo" },
  { id: "musica", label: "Música" },
  { id: "efecto", label: "Efectos" },
  { id: "anuncio", label: "Anuncios" },
  { id: "programa", label: "Programas" },
] as const;

/**
 * The sound library of the console: every audio can be dragged onto a timeline lane, a
 * player or the pad bank, pre-listened in the operator's headphones only, or sent with a click.
 */
export function SoundBrowser({ api, library, onPad }: { api: ConsoleApi; library: RadioTrack[]; onPad: (track: RadioTrack) => void }) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RadioTrack | null>(null);
  const [cue, setCue] = useState<{ id: string; at: number; length: number } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const text = query.trim().toLowerCase();
  const visible = library.filter((track) => (!filter || track.kind === filter) && (!text || `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(text)));

  useEffect(() => () => audio.current?.pause(), []);

  function preview(track: RadioTrack) {
    if (cue?.id === track.id) {
      audio.current?.pause();
      setCue(null);
      return;
    }
    audio.current?.pause();
    const el = new Audio(track.src);
    el.volume = 0.85;
    el.ontimeupdate = () => setCue((value) => (value?.id === track.id ? { ...value, at: el.currentTime } : value));
    el.onended = () => setCue(null);
    audio.current = el;
    setCue({ id: track.id, at: 0, length: track.duration });
    void el.play().catch(() => setCue(null));
  }

  function sendTo(lane: string) {
    if (selected) void api.drop(selected, lane);
  }

  async function onAir() {
    if (!selected || !window.confirm(`¿Poner «${selected.title}» al aire ahora en la pista principal? Corta lo que suena y corre la programación.`)) return;
    const result = await send("/admin/radio/lanzar", { tracks: [selected.id] });
    api.setNotice(result.error ? { tone: "error", text: result.error } : { tone: "info", text: result.message ?? "Al aire." });
  }

  return (
    <div className="cx-panel flex min-h-0 flex-col">
      <div className="cx-head">
        <p className="studio-label">Biblioteca · arrastra</p>
        <span className="text-[10.5px] text-white/35">{visible.length}</span>
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar sonido…" className="cx-input mt-2" aria-label="Buscar en la biblioteca" />
      <div className="mt-2 flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <button key={item.id} type="button" onClick={() => setFilter(item.id)} className="cx-chip" data-on={filter === item.id || undefined}>{item.label}</button>
        ))}
      </div>

      <ul className="cx-list mt-2" role="listbox" aria-label="Sonidos de la biblioteca">
        {visible.length ? (
          visible.map((track) => {
            const cueing = cue?.id === track.id;
            return (
              <li key={track.id} role="option" aria-selected={selected?.id === track.id}>
                <div
                  draggable
                  onDragStart={(event) => dragTrack(event, track)}
                  onClick={() => setSelected(track)}
                  onDoubleClick={() => onPad(track)}
                  className="cx-sound"
                  data-kind={track.kind}
                  data-on={selected?.id === track.id || undefined}
                  title={`${track.title} · arrastra a una pista, un reproductor o la botonera`}
                >
                  <span className="cx-grip" aria-hidden>⋮⋮</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-white/90">{track.title}</span>
                    <span className="block text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {KIND_LABEL[track.kind]} · {cueing ? `${duration(cue.at)} / ${duration(track.duration)}` : duration(track.duration)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      preview(track);
                    }}
                    className="cx-icon"
                    data-on={cueing || undefined}
                    aria-label={cueing ? `Detener pre-escucha de ${track.title}` : `Pre-escuchar ${track.title}`}
                    title="Pre-escucha: solo tú la oyes"
                  >
                    {cueing ? <StopIcon className="h-3 w-3" /> : <HeadphonesIcon className="h-3.5 w-3.5" />}
                  </button>
                  {cueing ? <span className="cx-cue" style={{ width: `${Math.min(100, (cue.at / Math.max(1, cue.length)) * 100)}%` }} /> : null}
                </div>
              </li>
            );
          })
        ) : (
          <li className="px-3 py-6 text-center text-xs text-white/40">
            Sin sonidos. <Link href="/admin/radio/biblioteca" className="underline">Súbelos en la Biblioteca</Link>.
          </li>
        )}
      </ul>

      <div className="mt-2 border-t border-white/10 pt-2">
        <p className="truncate text-[10.5px] text-white/45">{selected ? <>Enviar «<span className="text-white/80">{selected.title}</span>» a</> : "Elige un sonido para enviarlo a"}</p>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {[...BEDS, ...PLAYERS].map((lane) => (
            <button key={lane} type="button" disabled={!selected} onClick={() => sendTo(lane)} className="cx-key" data-lane={lane}>{lane}</button>
          ))}
          <button type="button" disabled={!selected} onClick={() => selected && onPad(selected)} className="cx-key" title="Agregar a la botonera">+Pad</button>
          <button type="button" disabled={!selected} onClick={onAir} className="cx-key" data-tone="red" title="Al aire ahora en la pista principal">Aire</button>
        </div>
      </div>
    </div>
  );
}

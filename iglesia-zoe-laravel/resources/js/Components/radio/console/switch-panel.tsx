import { useEffect, useState } from "react";
import { FallbackNotice, SourcePicker, sourceLabel } from "@/Components/radio/source-picker";
import { clock, type RadioBlock, type RadioPlaylist } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

/**
 * The live switch and the automatic music: automatic or manual mode, cut the music for the
 * live signal or return to it, and what the automatic music plays (applied when the song on
 * air ends, or right away when returning from the live signal).
 */
export function SwitchPanel({ api, day, playlists }: { api: ConsoleApi; day: RadioBlock[]; playlists: RadioPlaylist[] }) {
  const { state, config, autopilot, now } = api;
  const live = state.live;
  const external = config.live_source === "externo";
  const auto = config.live_mode !== "manual";
  const cut = Boolean(live.cut);
  const span = live.window ?? null;
  const block = day.find((item) => item.kind === "vivo" && item.layer === 0 && item.start <= now && now < item.end) ?? null;
  const [playlist, setPlaylist] = useState(autopilot.playlist ?? "");
  const [shuffle, setShuffle] = useState(autopilot.shuffle);
  const [busy, setBusy] = useState(false);
  const changed = playlist !== (autopilot.playlist ?? "") || shuffle !== autopilot.shuffle;
  const current = sourceLabel(playlists, autopilot.playlist ?? "", autopilot.shuffle);
  const chosen = sourceLabel(playlists, playlist, shuffle);

  useEffect(() => {
    setPlaylist(autopilot.playlist ?? "");
    setShuffle(autopilot.shuffle);
  }, [autopilot.playlist, autopilot.shuffle]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    await action();
    setBusy(false);
  }

  const status = cut
    ? `Al aire en vivo${span?.title ? ` · ${span.title}` : ""} desde ${span ? clock(span.start) : "--"}${span?.end ? `. La música vuelve sola a las ${clock(span.end)}` : ". La música vuelve cuando lo indiques"}.`
    : block && auto
      ? `«${block.title}» está programado hasta las ${clock(block.end)}: ${external ? "cuando la señal externa responda" : "al abrir la transmisión"} se corta la música sola. Mientras tanto suena el piloto automático.`
      : `Suena el piloto automático: ${current}${autopilot.since > now ? ` (empieza a las ${clock(autopilot.since)})` : ""}.`;

  return (
    <div className="cx-panel mt-2" data-live={cut || undefined}>
      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <p className="studio-label">En vivo</p>
          <div className="cx-seg" role="radiogroup" aria-label="Modo del vivo">
            {(
              [
                ["auto", "Automático", "En los bloques en vivo la música se corta sola al conectarte y vuelve sola al terminar"],
                ["manual", "Manual", "La música solo se corta y vuelve cuando lo indicas"],
              ] as const
            ).map(([value, label, hint]) => (
              <button key={value} type="button" role="radio" aria-checked={config.live_mode === value} data-on={config.live_mode === value || undefined} title={hint} disabled={busy} onClick={() => act(() => api.setLiveMode(value))}>
                {label}
              </button>
            ))}
          </div>
          <span className="cx-stat" title="Se cambia en Ajustes › En vivo">
            <span className="cx-stat-key">Fuente</span> {external ? "Señal externa (OBS)" : "Consola"}
          </span>
        </div>

        <p className={`text-[12px] leading-5 ${cut ? "text-red-200" : "text-white/65"}`}>
          {cut ? <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 align-middle" /> : null}
          {status}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {cut ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => api.resumeMusic(changed ? { playlist, shuffle } : undefined))}
              className="cx-btn !py-2"
              data-tone="green"
              title={`Vuelve la música automática con: ${chosen}`}
            >
              Volver a la música · {chosen}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || (!external && !live.session)}
              onClick={() => act(api.cutMusic)}
              className="cx-btn !py-2"
              data-tone="red"
              title={!external && !live.session ? "Abre la transmisión en vivo primero" : "Corta la música automática para todos los oyentes"}
            >
              Cortar música · ir al vivo
            </button>
          )}
        </div>
      </div>

      <div className="mt-2.5 grid gap-2 border-t border-white/5 pt-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="studio-label mb-1">
            {cut ? "Al volver del vivo sigue" : "Sigue en automático"} · <span className="normal-case tracking-normal text-white/80">{changed ? chosen : current}</span>
          </p>
          <SourcePicker studio playlists={playlists} playlist={playlist} shuffle={shuffle} onPlaylist={setPlaylist} onShuffle={setShuffle} />
          <div className="mt-1.5 empty:hidden">
            <FallbackNotice studio autopilot={autopilot} />
          </div>
        </div>
        {cut ? null : (
          <button type="button" disabled={busy || !changed} onClick={() => act(() => api.switchSource(playlist, shuffle))} className="cx-btn !py-2" data-tone="blue" title="Se aplica cuando termine la canción que suena">
            {changed ? "Aplicar al terminar la canción" : "Ya está sonando"}
          </button>
        )}
      </div>
    </div>
  );
}

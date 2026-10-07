import { useEffect, useState } from "react";
import { FallbackNotice, PendingSwitch, SourcePicker, SwitchScheduler, sourceLabel } from "@/Components/radio/source-picker";
import { clock, type RadioBlock, type RadioPlaylist } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

const POINTS = { action: "points" };

/**
 * The live switch and the automatic music: automatic or manual mode, cut the music for the
 * live signal or return to it, and what the automatic music plays (a change lands when the
 * song on air ends or at a song boundary the operator picks, or right away when returning
 * from the live signal).
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

  function reset() {
    setPlaylist(autopilot.playlist ?? "");
    setShuffle(autopilot.shuffle);
  }

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
      : autopilot.pending && autopilot.since > now
        ? `Suena el piloto automático: ${autopilot.pending.label}. A las ${clock(autopilot.since, true)} cambia a ${current}.`
        : `Suena el piloto automático: ${current}.`;

  const chip = cut
    ? `En vivo desde ${span ? clock(span.start) : "--"}${span?.end ? ` · vuelve ${clock(span.end)}` : ""}`
    : block && auto
      ? `Vivo programado hasta ${clock(block.end)}`
      : null;

  return (
    <div className="cx-panel mt-2" data-live={cut || undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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

        <span className="hidden h-5 w-px bg-white/10 xl:block" aria-hidden />

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="studio-label" title={chip ? undefined : status}>
            {cut ? "Al volver sigue" : "Sigue en automático"}
          </p>
          <SourcePicker
            studio
            playlists={playlists}
            playlist={playlist}
            shuffle={shuffle}
            onPlaylist={setPlaylist}
            onShuffle={setShuffle}
          />
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {chip ? (
            <span className={`cx-stat min-w-0 ${cut ? "!bg-red-500/15 !text-red-100" : "!text-amber-100"}`} title={status}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cut ? "animate-pulse bg-red-500" : "bg-amber-400"}`} />
              <span className="truncate">{chip}</span>
            </span>
          ) : null}
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

      <div className="mt-2 grid gap-1.5 empty:hidden">
        {!cut && changed ? (
          <SwitchScheduler
            studio
            endpoint="/admin/radio/musica-continua"
            pointsRequest={POINTS}
            target={chosen}
            now={now}
            busy={busy}
            onConfirm={(timing) => act(() => api.switchSource(playlist, shuffle, timing))}
            onClose={reset}
          />
        ) : null}
        <PendingSwitch studio autopilot={autopilot} now={now} busy={busy} onCancel={() => act(api.cancelSwitch)} />
        <FallbackNotice studio autopilot={autopilot} />
      </div>
    </div>
  );
}

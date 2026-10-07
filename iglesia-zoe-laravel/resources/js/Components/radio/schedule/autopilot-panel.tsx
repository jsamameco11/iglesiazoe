import { useEffect, useState } from "react";
import { Notice, useAction } from "@/Components/admin/ui";
import { FallbackNotice, PendingSwitch, SourcePicker, SwitchScheduler, sourceLabel } from "@/Components/radio/source-picker";
import { send } from "@/lib/actions";
import { clock, type Autopilot, type RadioPlaylist } from "@/lib/radio";

const ENDPOINT = "/admin/radio/programacion/piloto";
const POINTS = { points: "1" };

/** The station's automatic music: what fills every space without a block, on or off, repeating or once. */
export function AutopilotPanel({ autopilot, playlists, now }: { autopilot: Autopilot; playlists: RadioPlaylist[]; now: number }) {
  const [playlist, setPlaylist] = useState(autopilot.playlist ?? "");
  const [shuffle, setShuffle] = useState(autopilot.shuffle);
  const { result, setResult, pending, run } = useAction();
  const changed = playlist !== (autopilot.playlist ?? "") || shuffle !== autopilot.shuffle;
  const scheduled = Boolean(autopilot.pending) && autopilot.since > now;
  const current = sourceLabel(playlists, autopilot.playlist ?? "", autopilot.shuffle);
  const on = !autopilot.paused;
  const repeat = autopilot.repeat ?? true;
  const status = !on ? "Detenido" : autopilot.finished ? "Terminó" : autopilot.level === "none" ? "Sin canciones" : "Activo";

  useEffect(() => {
    setPlaylist(autopilot.playlist ?? "");
    setShuffle(autopilot.shuffle);
  }, [autopilot.playlist, autopilot.shuffle]);

  function toggleOn() {
    if (on && !window.confirm("¿Detener el modo automático? Lo que no esté programado quedará en silencio.")) return;
    run(() => send(ENDPOINT, { on: on ? "0" : "1" }));
  }

  return (
    <section className="rounded-[1.6rem] border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Modo automático</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status === "Activo" ? "bg-emerald-100 text-emerald-800" : status === "Detenido" ? "bg-paper text-muted" : "bg-amber-100 text-amber-800"}`}>{status}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">
        {on ? "Suena" : "Elegido"}: {scheduled ? autopilot.pending?.label : current}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
        {!on
          ? "Detenido: solo suena lo programado y lo demás es silencio."
          : autopilot.finished
            ? "Ya sonó completa y «Repetir» está apagado: la radio está en silencio."
            : repeat
              ? "Se repite: al terminar vuelve a empezar."
              : `Una sola vez${autopilot.until ? `: termina a las ${clock(autopilot.until)}` : ""} y luego silencio.`}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={toggleOn}
          className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${on ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}
        >
          {on ? "Detener" : "Activar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => send(ENDPOINT, { repeat: repeat ? "0" : "1" }))}
          aria-pressed={repeat}
          title={repeat ? "Al terminar, vuelve a empezar. Clic para que suene una sola vez." : "Suena una sola vez y luego silencio. Clic para que se repita."}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${repeat ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${repeat ? "bg-emerald-300" : "bg-line"}`} />
          Repetir
        </button>
      </div>

      <p className="mt-3 text-[12.5px] leading-5 text-muted">
        Llena los espacios libres y los bloques en vivo sin nadie conectado. Los periodos de «Música automática» usan su propia lista. Si la lista elegida se queda sin canciones, la radio queda en silencio: solo suena lo que configures.
      </p>
      <div className="mt-2 grid gap-2 empty:hidden">
        <PendingSwitch autopilot={autopilot} now={now} busy={pending} onCancel={() => run(() => send(ENDPOINT, { cancel: "1" }))} />
        <FallbackNotice autopilot={autopilot} />
      </div>
      <div className="mt-3">
        <SourcePicker playlists={playlists} playlist={playlist} shuffle={shuffle} onPlaylist={setPlaylist} onShuffle={setShuffle} />
      </div>
      <div className="mt-3">
        <Notice result={result} onClose={() => setResult(null)} />
      </div>
      {changed ? (
        <div className="mt-2">
          <SwitchScheduler
            endpoint={ENDPOINT}
            pointsRequest={POINTS}
            target={sourceLabel(playlists, playlist, shuffle)}
            now={now}
            busy={pending}
            onConfirm={(timing) => run(() => send(ENDPOINT, { playlist, shuffle: shuffle ? "1" : "0", when: timing.when, ...(timing.when === "at" ? { at: String(timing.at) } : {}) }))}
            onClose={() => {
              setPlaylist(autopilot.playlist ?? "");
              setShuffle(autopilot.shuffle);
            }}
          />
        </div>
      ) : (
        <p className="mt-2 text-[11.5px] leading-4 text-muted">Elige otra lista o canciones aleatorias para programar el cambio: entra al terminar la canción que suena o en el punto que elijas, sin cortes.</p>
      )}
    </section>
  );
}

import { clock } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

const input = "rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30";

/** Opens and closes the live broadcast: host name, microphone and voice processing. */
export function LivePanel({ api }: { api: ConsoleApi }) {
  const { live, micOpen, mic, devices, hostName, setHostName, busy } = api;

  return (
    <div className="studio-panel">
      <p className="studio-label">Transmisión en vivo</p>
      {live.session ? (
        <div className="mt-3 space-y-4">
          <p className="text-sm leading-6 text-white/70">
            Al aire desde las {live.started_at ? clock(live.started_at) : "--"} como <strong className="text-white">{live.host}</strong>. Mantén esta pestaña abierta mientras dure la transmisión.
          </p>
          {!micOpen ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
              Esta pestaña no tiene el micrófono conectado (¿recargaste la página?).
              <button type="button" onClick={api.openMic} className="studio-btn mt-3" data-on="amber">Conectar micrófono</button>
            </div>
          ) : null}
          <label className="block text-xs font-semibold text-white/50">
            Nombre al aire
            <div className="mt-1.5 flex gap-2">
              <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} className={`min-w-0 flex-1 ${input}`} />
              <button type="button" onClick={() => api.liveAction({ action: "mix", host: hostName })} className="studio-btn !w-auto">Guardar</button>
            </div>
          </label>
          <button type="button" disabled={busy} onClick={api.stopLive} className="studio-btn" data-on="red">Terminar transmisión</button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-white/65">Abre la transmisión para hablar en vivo. Tu voz llega a cada oyente al instante, encima de la música.</p>
          <label className="block text-xs font-semibold text-white/50">
            Nombre al aire
            <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} className={`mt-1.5 w-full ${input}`} />
          </label>
          {devices.length > 1 ? (
            <label className="block text-xs font-semibold text-white/50">
              Micrófono
              <select value={mic.deviceId} onChange={(event) => api.changeMic({ deviceId: event.target.value })} className={`mt-1.5 w-full ${input}`}>
                <option value="">Predeterminado del sistema</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || "Micrófono"}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-start gap-2 text-sm text-white/70">
            <input type="checkbox" checked={mic.processing} onChange={(event) => api.changeMic({ processing: event.target.checked })} className="mt-1" />
            <span>Reducir eco y ruido <span className="block text-xs text-white/40">Desactívalo si usas una consola o micrófono profesional.</span></span>
          </label>
          <button type="button" disabled={busy} onClick={api.startLive} className="studio-talk !min-h-[3.4rem] !text-sm" data-on="">
            {busy ? "Conectando…" : "Abrir transmisión en vivo"}
          </button>
        </div>
      )}
    </div>
  );
}

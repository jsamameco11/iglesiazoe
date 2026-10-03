import { clock } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

/** Opens and closes the live broadcast: host name, microphone and voice processing. */
export function LivePanel({ api }: { api: ConsoleApi }) {
  const { live, micOpen, mic, devices, hostName, setHostName, busy } = api;

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Transmisión en vivo</p>
        {live.session ? <span className="cx-badge" data-tone="red">Desde {live.started_at ? clock(live.started_at) : "--"}</span> : null}
      </div>
      {live.session ? (
        <div className="mt-2 space-y-2">
          <p className="text-[12px] leading-5 text-white/60">
            Al aire como <strong className="text-white">{live.host}</strong>. Mantén esta pestaña abierta.
          </p>
          {!micOpen ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[12px] text-amber-100">
              <span className="flex-1">Esta pestaña no tiene el micrófono conectado.</span>
              <button type="button" onClick={api.openMic} className="cx-btn" data-tone="amber">Conectar</button>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} className="cx-input min-w-0 flex-1" aria-label="Nombre al aire" />
            <button type="button" onClick={() => api.liveAction({ action: "mix", host: hostName })} className="cx-btn">Guardar</button>
          </div>
          <button type="button" disabled={busy} onClick={api.stopLive} className="cx-btn w-full justify-center !py-2" data-tone="red">Terminar transmisión</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} placeholder="Nombre al aire" className="cx-input w-full" aria-label="Nombre al aire" />
          {devices.length > 1 ? (
            <select value={mic.deviceId} onChange={(event) => api.changeMic({ deviceId: event.target.value })} className="cx-select w-full" aria-label="Micrófono">
              <option value="">Micrófono predeterminado</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || "Micrófono"}</option>
              ))}
            </select>
          ) : null}
          <label className="flex items-center gap-2 text-[12px] text-white/60" title="Desactívalo si usas una consola o micrófono profesional">
            <input type="checkbox" checked={mic.processing} onChange={(event) => api.changeMic({ processing: event.target.checked })} />
            Reducir eco y ruido
          </label>
          <button type="button" disabled={busy} onClick={api.startLive} className="cx-btn w-full justify-center !py-2.5" data-tone="red">
            {busy ? "Conectando…" : "Abrir transmisión en vivo"}
          </button>
        </div>
      )}
    </div>
  );
}

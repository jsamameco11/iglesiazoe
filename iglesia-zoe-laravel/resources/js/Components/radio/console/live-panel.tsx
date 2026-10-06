import { useState } from "react";
import { clock } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

/**
 * Name of the episode or transmission the listeners see. Before going live it is the name the
 * transmission will open with; while live, Enter or leaving the field puts the new name on air.
 */
export function EpisodeField({ api, wide = false }: { api: ConsoleApi; wide?: boolean }) {
  const { live, episodeTitle, setEpisodeTitle } = api;
  const [saving, setSaving] = useState(false);
  const changed = live.session !== null && episodeTitle.trim() !== (live.title ?? "");

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    await api.liveAction({ action: "mix", title: episodeTitle.trim() });
    setSaving(false);
  }

  return (
    <label className={`cx-episode ${wide ? "w-full" : "min-w-0 max-w-[22rem] flex-1"}`} title="Es lo que ven los oyentes mientras estás en vivo">
      <span className="cx-stat-key shrink-0">Episodio</span>
      <input
        value={episodeTitle}
        onChange={(event) => setEpisodeTitle(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), void save())}
        maxLength={120}
        placeholder="Nombre del episodio o transmisión"
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-white outline-none placeholder:text-white/35"
        aria-label="Nombre del episodio o transmisión"
      />
      {changed ? (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={save} disabled={saving} className="cx-btn !px-2 !py-0.5 !text-[11px]" data-tone="green">
          {saving ? "…" : "Guardar"}
        </button>
      ) : live.session ? (
        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Al aire</span>
      ) : null}
    </label>
  );
}

/** Opens and closes the live broadcast: episode name, microphone and voice processing. */
export function LivePanel({ api }: { api: ConsoleApi }) {
  const { live, micOpen, mic, devices, busy, talking, speaking } = api;
  const voiceOptions = (
    <div className="grid grid-cols-2 gap-1.5">
      <button type="button" onClick={() => api.changeMic({ voiceDuck: !mic.voiceDuck })} className="cx-btn justify-center" data-tone={mic.voiceDuck ? "green" : undefined} aria-pressed={mic.voiceDuck} title="Al detectar tu voz, la música y los sonidos bajan al 25% de inmediato y vuelven cuando callas">
        <span className={`h-1.5 w-1.5 rounded-full ${mic.voiceDuck ? "bg-emerald-300" : "bg-white/40"}`} />
        Detectar voz
      </button>
      <button type="button" onClick={() => api.changeMic({ talkOnStart: !mic.talkOnStart })} className="cx-btn justify-center" data-tone={mic.talkOnStart ? "green" : undefined} aria-pressed={mic.talkOnStart} title="Al abrir la transmisión el micrófono sale al aire de inmediato, sin presionar «Hablar»">
        <span className={`h-1.5 w-1.5 rounded-full ${mic.talkOnStart ? "bg-emerald-300" : "bg-white/40"}`} />
        Hablar directo
      </button>
    </div>
  );

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Transmisión en vivo</p>
        {live.session ? <span className="cx-badge" data-tone="red">Desde {live.started_at ? clock(live.started_at) : "--"}</span> : null}
      </div>
      {live.session ? (
        <div className="mt-2 space-y-2">
          <EpisodeField api={api} wide />
          <p className="text-[12px] leading-5 text-white/60">
            Mantén esta pestaña abierta.
          </p>
          {!micOpen ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[12px] text-amber-100">
              <span className="flex-1">Esta pestaña no tiene el micrófono conectado.</span>
              <button type="button" onClick={api.openMic} className="cx-btn" data-tone="amber">Conectar</button>
            </div>
          ) : null}
          {micOpen ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/60">
              <span className="voice-tag" data-on={(talking && mic.voiceDuck && speaking) || undefined}>Voz</span>
              <span className="flex-1">
                {!talking ? "Micrófono cerrado: presiona «Hablar»." : !mic.voiceDuck ? "Micrófono al aire." : speaking ? "Se oye tu voz: música al 25%." : "Al aire: la música baja cuando hables."}
              </span>
              <button type="button" onClick={api.toggleTalk} className="cx-btn !py-1" data-tone={talking ? "red" : "green"}>
                {talking ? "Cerrar mic" : "Hablar"}
              </button>
            </div>
          ) : null}
          {voiceOptions}
          <button type="button" disabled={busy} onClick={api.stopLive} className="cx-btn w-full justify-center !py-2" data-tone="red">Terminar transmisión</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <EpisodeField api={api} wide />
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
          {voiceOptions}
          <p className="text-[11.5px] leading-5 text-white/45">Usa audífonos para escucharte: si la música sale por parlantes, el micrófono la vuelve a captar y tu voz se oye peor.</p>
          <button type="button" disabled={busy} onClick={api.startLive} className="cx-btn w-full justify-center !py-2.5" data-tone="red">
            {busy ? "Conectando…" : "Abrir transmisión en vivo"}
          </button>
        </div>
      )}
    </div>
  );
}

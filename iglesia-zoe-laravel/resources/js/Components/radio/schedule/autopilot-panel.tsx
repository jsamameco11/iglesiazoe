import { useEffect, useState } from "react";
import { Notice, button, useAction } from "@/Components/admin/ui";
import { FallbackNotice, PendingSwitch, SourcePicker, leadLabel, sourceLabel } from "@/Components/radio/source-picker";
import { send } from "@/lib/actions";
import type { Autopilot, RadioPlaylist, RadioSpotifyPlaylist } from "@/lib/radio";

/** The station's automatic music: what fills every space without a block, 24/7. */
export function AutopilotPanel({ autopilot, playlists, references, now }: { autopilot: Autopilot; playlists: RadioPlaylist[]; references: RadioSpotifyPlaylist[]; now: number }) {
  const [playlist, setPlaylist] = useState(autopilot.playlist ?? "");
  const [shuffle, setShuffle] = useState(autopilot.shuffle);
  const { result, setResult, pending, run } = useAction();
  const changed = playlist !== (autopilot.playlist ?? "") || shuffle !== autopilot.shuffle;
  const scheduled = Boolean(autopilot.pending) && autopilot.since > now;
  const current = sourceLabel(playlists, autopilot.playlist ?? "", autopilot.shuffle);
  const lead = leadLabel(autopilot.lead ?? 300);

  useEffect(() => {
    setPlaylist(autopilot.playlist ?? "");
    setShuffle(autopilot.shuffle);
  }, [autopilot.playlist, autopilot.shuffle]);

  return (
    <section className="rounded-[1.6rem] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Piloto automático · 24/7</p>
      <p className="mt-2 text-sm font-semibold">
        Ahora: {scheduled ? autopilot.pending?.label : current}
        {autopilot.paused ? <span className="ml-2 text-xs font-semibold text-amber-700">en pausa desde la consola</span> : null}
      </p>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">
        Suena en todos los espacios libres y cuando un bloque en vivo no tiene a nadie conectado. Los periodos de «Música automática» usan su propia lista.
        Si una fuente falla, sigue sola con todas tus listas y, si tampoco hay, con toda la biblioteca en aleatorio.
      </p>
      <div className="mt-2 grid gap-2 empty:hidden">
        <PendingSwitch autopilot={autopilot} now={now} busy={pending} onCancel={() => run(() => send("/admin/radio/programacion/piloto", { cancel: "1" }))} />
        <FallbackNotice autopilot={autopilot} />
      </div>
      <div className="mt-3">
        <SourcePicker
          playlists={playlists}
          playlist={playlist}
          shuffle={shuffle}
          onPlaylist={setPlaylist}
          onShuffle={setShuffle}
          references={references}
        />
      </div>
      <div className="mt-3">
        <Notice result={result} onClose={() => setResult(null)} />
      </div>
      <button
        type="button"
        disabled={pending || !changed}
        onClick={() => run(() => send("/admin/radio/programacion/piloto", { playlist, shuffle: shuffle ? "1" : "0" }))}
        className={`${button} mt-2 w-full`}
      >
        {pending ? "Guardando…" : changed ? `Programar cambio a: ${sourceLabel(playlists, playlist, shuffle)}` : "Ya suena esta música"}
      </button>
      <p className="mt-2 text-[11.5px] leading-4 text-muted">
        El cambio entra con al menos {lead} de anticipación y justo cuando termina una canción, para que no se note el corte. La anticipación se ajusta en Ajustes (de 30 s a 30 min).
      </p>
    </section>
  );
}

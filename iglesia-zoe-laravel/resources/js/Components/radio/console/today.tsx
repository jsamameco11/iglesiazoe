import { Link } from "@inertiajs/react";
import { useState } from "react";
import { KindTag } from "@/Components/radio/admin-ui";
import { DuckIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { KIND_LABEL, clock, duration, layerLabel, type RadioBlock, type RadioTrack } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

/** «Al aire ahora»: replaces what plays on the main program right away. */
export function LaunchNow({ api, library }: { api: ConsoleApi; library: RadioTrack[] }) {
  const [launch, setLaunch] = useState("");

  async function go() {
    if (!launch) return;
    const result = await send("/admin/radio/lanzar", { tracks: [launch] });
    api.setNotice(result.error ? { tone: "error", text: result.error } : { tone: "info", text: result.message ?? "Al aire." });
    setLaunch("");
  }

  return (
    <div className="studio-panel">
      <p className="studio-label">Al aire ahora · pista principal</p>
      <p className="mt-1 text-[11px] leading-4 text-white/40">Corta lo que suena en la pista principal, reproduce el audio de inmediato y corre la programación siguiente lo necesario. Para sonar encima usa la botonera o los reproductores.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select value={launch} onChange={(event) => setLaunch(event.target.value)} className="cart-select min-w-0 flex-1">
          <option value="">Elige un audio de la biblioteca…</option>
          {library.map((track) => (
            <option key={track.id} value={track.id}>{KIND_LABEL[track.kind]} · {track.title} ({duration(track.duration)})</option>
          ))}
        </select>
        <button type="button" disabled={!launch} onClick={go} className="studio-btn sm:!w-auto" data-on={launch ? "red" : undefined}>Lanzar</button>
      </div>
    </div>
  );
}

/** Today's timeline on every layer, with the block on air highlighted. */
export function TodayList({ day, now, autofill }: { day: RadioBlock[]; now: number; autofill: boolean }) {
  return (
    <div className="studio-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="studio-label">Programación de hoy</p>
        <Link href="/admin/radio/programacion" className="text-xs font-semibold text-white/50 hover:text-white">Abrir línea de tiempo →</Link>
      </div>
      {day.length ? (
        <ul className="mt-2 max-h-80 divide-y divide-white/5 overflow-y-auto pr-1">
          {day.map((block) => {
            const isNow = block.start <= now && now < block.end;
            return (
              <li key={block.id} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${isNow ? "bg-white/10" : block.end < now ? "opacity-40" : ""}`}>
                <span className="w-36 shrink-0 font-mono text-xs tabular-nums text-white/55">{clock(block.start, true)} – {clock(block.end, true)}</span>
                <span className="today-lane" data-layer={block.layer}>{block.layer ? layerLabel(block.layer) : "Principal"}</span>
                <span className="min-w-0 flex-1 truncate text-white/85">{block.title}</span>
                {block.layer && block.duck ? <DuckIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" /> : null}
                {isNow ? <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">Ahora</span> : null}
                <KindTag kind={block.kind} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-white/45">
          No hay bloques para hoy. {autofill ? "Suena la música continua." : "La música continua está apagada (Ajustes)."}
        </p>
      )}
    </div>
  );
}

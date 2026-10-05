import { Link } from "@inertiajs/react";
import { useState } from "react";
import { KindTag } from "@/Components/radio/admin-ui";
import { DuckIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { KIND_LABEL, clock, duration, layerLabel, type RadioBlock, type RadioTrack, type RadioUpcoming } from "@/lib/radio";
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
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Al aire ahora · programa</p>
      </div>
      <p className="mt-1 text-[10.5px] leading-4 text-white/35">Corta la pista principal y corre la programación. Para sonar encima usa fondos, reproductores o botonera.</p>
      <div className="mt-2 flex gap-1.5">
        <select value={launch} onChange={(event) => setLaunch(event.target.value)} className="cx-select min-w-0 flex-1">
          <option value="">Elige un audio de la biblioteca…</option>
          {library.map((track) => (
            <option key={track.id} value={track.id}>{KIND_LABEL[track.kind]} · {track.title} ({duration(track.duration)})</option>
          ))}
        </select>
        <button type="button" disabled={!launch} onClick={go} className="cx-btn" data-tone={launch ? "red" : undefined}>Lanzar</button>
      </div>
    </div>
  );
}

/** Today's timeline on every layer, with the block on air highlighted and the coming ones in red. */
export function TodayList({ day, now, autofill, upcoming, onAlert }: { day: RadioBlock[]; now: number; autofill: boolean; upcoming: RadioUpcoming[]; onAlert: (id: string) => void }) {
  return (
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Programación de hoy</p>
        <Link href="/admin/radio/programacion" className="text-[11px] font-semibold text-white/45 hover:text-white">Editar →</Link>
      </div>
      {day.length ? (
        <ul className="mt-1.5 max-h-52 divide-y divide-white/5 overflow-y-auto pr-1">
          {day.map((block) => {
            const alert = upcoming.find((item) => item.id === block.id);
            const isNow = !alert?.held && block.start <= now && now < block.end;
            return (
              <li
                key={block.id}
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] ${alert ? "cursor-pointer bg-red-500/15 ring-1 ring-red-500/40" : isNow ? "bg-white/10" : block.end < now ? "opacity-40" : ""}`}
                {...(alert ? { onClick: () => onAlert(alert.id), title: "Ver el aviso y reprogramar" } : {})}
              >
                <span className="w-[6.5rem] shrink-0 font-mono text-[10.5px] tabular-nums text-white/55">{clock(block.start)} – {clock(block.end)}</span>
                <span className="today-lane" data-layer={block.layer}>{block.layer ? layerLabel(block.layer) : "Principal"}</span>
                <span className="min-w-0 flex-1 truncate text-white/85">{block.title}</span>
                {block.layer && block.duck ? <DuckIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" /> : null}
                {isNow ? <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">Ahora</span> : null}
                {alert ? (
                  <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-red-300">
                    {alert.held ? "tras el vivo" : `en ${duration(Math.max(0, alert.start - now) / 1000)}`}
                  </span>
                ) : null}
                <KindTag kind={block.kind} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-white/45">
          No hay bloques para hoy. {autofill ? "Suena el modo automático." : "Modo automático detenido: la radio está en silencio."}
        </p>
      )}
    </div>
  );
}

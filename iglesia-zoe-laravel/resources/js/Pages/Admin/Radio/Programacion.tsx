import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RadioHeader } from "@/Components/radio/admin-ui";
import { AddPanel } from "@/Components/radio/schedule/add-panel";
import { AutopilotPanel } from "@/Components/radio/schedule/autopilot-panel";
import { BlockRow } from "@/Components/radio/schedule/block-row";
import { DayTools } from "@/Components/radio/schedule/day-tools";
import { LaneRuler } from "@/Components/radio/schedule/lane-ruler";
import { RotationPanel } from "@/Components/radio/schedule/rotation-panel";
import AdminLayout from "@/Layouts/AdminLayout";
import {
  DAY_MS,
  clock,
  dayLabel,
  dayStart,
  longDuration,
  type Autopilot,
  type RadioBlock,
  type RadioConfig,
  type RadioPlaylist,
  type RadioSpotifyPlaylist,
  type RadioTrack,
} from "@/lib/radio";
import "../../../../css/radio.css";

type Day = { date: string; blocks: number; seconds: number };

type Props = {
  date: string;
  today: string;
  now: number;
  blocks: RadioBlock[];
  dayEnds: Record<number, number | null>;
  days: Day[];
  tracks: RadioTrack[];
  config: RadioConfig;
  playlists: RadioPlaylist[];
  spotifyReferences: RadioSpotifyPlaylist[];
  autopilot: Autopilot;
};

type Row = { type: "gap"; from: number; to: number } | { type: "block"; block: RadioBlock };

function useNow(initial: number) {
  const offset = useRef(initial - Date.now());
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export default function Programacion({ date, today, now: serverNow, blocks, dayEnds, days, tracks, config, playlists, spotifyReferences, autopilot }: Props) {
  const now = useNow(serverNow);
  const start = dayStart(date);
  const end = start + DAY_MS;
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const isToday = date === today;
  const isPast = date < today;
  const main = blocks.filter((block) => block.layer === 0);
  const overlays = blocks.length - main.length;
  const total = main.reduce((sum, block) => sum + (Math.min(block.end, end) - Math.max(block.start, start)), 0) / 1000;

  function go(next: string) {
    router.get("/admin/radio/programacion", { fecha: next }, { preserveScroll: true });
  }

  function togglePreview(block: RadioBlock) {
    audio.current ??= new Audio();
    if (preview === block.id) {
      audio.current.pause();
      setPreview(null);
      return;
    }
    if (!block.src) return;
    audio.current.src = block.src;
    audio.current.onended = () => setPreview(null);
    void audio.current.play();
    setPreview(block.id);
  }

  useEffect(() => () => audio.current?.pause(), []);

  const rows = useMemo(() => {
    const list: Row[] = [];
    let cursor = start;
    for (const block of blocks.filter((item) => item.layer === 0)) {
      if (block.start - cursor > 1000) list.push({ type: "gap", from: cursor, to: block.start });
      cursor = Math.max(cursor, block.end);
    }
    if (end - cursor > 1000) list.push({ type: "gap", from: cursor, to: end });
    blocks.forEach((block) => list.push({ type: "block", block }));
    const at = (row: Row) => (row.type === "gap" ? row.from : row.block.start);
    return list.sort((a, b) => at(a) - at(b) || (a.type === "gap" ? -1 : 1));
  }, [blocks, start, end]);

  return (
    <AdminLayout>
      <RadioHeader
        title="Programación"
        text="Arma la línea de tiempo de cada día: la pista principal lleva el programa (audios, periodos de música automática y bloques en vivo) y hasta tres capas suenan encima (anuncios, cortinas, efectos). Los espacios libres se llenan solos con el piloto automático."
      />

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => go(day.date)}
            className={`min-w-[6.6rem] shrink-0 rounded-2xl border px-3 py-2.5 text-left transition ${day.date === date ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
          >
            <span className="block text-[13px] font-semibold capitalize">{dayLabel(day.date, today)}</span>
            <span className={`mt-0.5 block text-[11px] ${day.date === date ? "text-white/60" : "text-muted"}`}>
              {day.blocks ? `${day.blocks} bloques · ${longDuration(day.seconds)}` : "Vacío"}
            </span>
          </button>
        ))}
        <label className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-line bg-white px-3 text-xs font-semibold text-muted">
          Otro día
          <input type="date" value={date} onChange={(event) => event.target.value && go(event.target.value)} className="rounded-lg border border-line px-2 py-1 text-sm text-ink" />
        </label>
      </div>

      <section className="mt-4 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Línea de tiempo</p>
            <h2 className="mt-1 text-2xl font-semibold capitalize tracking-[-0.03em]">
              {new Date(start + 12 * 3600000).toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
          <p className="text-sm text-muted">
            {main.length} bloques · {longDuration(total)} programados{overlays ? ` · ${overlays} en capas` : ""} · {config.autofill ? `${longDuration(Math.max(0, 86400 - total))} de música continua` : "música continua apagada"}
          </p>
        </div>
        <LaneRuler blocks={blocks} start={start} now={now} isToday={isToday} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section className="min-w-0 rounded-[1.6rem] border border-line bg-card p-4 md:p-6">
          {blocks.length === 0 ? (
            <p className="rounded-[1.4rem] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              Este día no tiene bloques. {config.autofill ? "Sonará la música continua todo el día." : "Con la música continua apagada, la radio estará en silencio."} Agrega bloques con el panel de la derecha.
            </p>
          ) : (
            <div className="space-y-1">
              {rows.map((row) =>
                row.type === "gap" ? (
                  <div key={`gap-${row.from}`} className="tl-item py-2">
                    <p className="pt-1 text-right font-mono text-[11px] tabular-nums text-muted">{clock(row.from)}</p>
                    <p className="ml-6 rounded-xl border border-dashed border-line px-3 py-2 text-[12.5px] text-muted">
                      {config.autofill ? `Piloto automático · ${autopilot.label}` : "Silencio"} · {longDuration((row.to - row.from) / 1000)}
                    </p>
                  </div>
                ) : (
                  <BlockRow
                    key={row.block.id}
                    block={row.block}
                    date={date}
                    now={now}
                    editing={editing === row.block.id}
                    previewing={preview === row.block.id}
                    playlists={playlists}
                    onEdit={() => setEditing(editing === row.block.id ? null : row.block.id)}
                    onPreview={() => togglePreview(row.block)}
                  />
                ),
              )}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          {isPast ? (
            <p className="rounded-[1.4rem] border border-line bg-card p-5 text-sm text-muted">Este día ya pasó. Puedes copiar su programación a días futuros.</p>
          ) : (
            <AddPanel date={date} isToday={isToday} dayEnds={dayEnds} tracks={tracks} playlists={playlists} />
          )}
          <AutopilotPanel autopilot={autopilot} playlists={playlists} references={spotifyReferences} now={now} />
          <RotationPanel tracks={tracks} autofill={config.autofill} crossfade={config.crossfade} />
          <DayTools date={date} today={today} hasBlocks={blocks.length > 0} />
        </aside>
      </div>
    </AdminLayout>
  );
}

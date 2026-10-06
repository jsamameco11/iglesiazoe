import { useState } from "react";
import type { ProgramItem } from "@/Components/radio/use-program";
import { clock, duration } from "@/lib/radio";

/** Songs shown before «Ver todas». */
const FIRST = 6;

/**
 * The songs the automatic music plays in a stretch of the day, as the listeners will hear them:
 * what comes next first, and what already played folded away.
 */
export function UpcomingSongs({ songs, now }: { songs: ProgramItem[]; now: number }) {
  const [all, setAll] = useState(false);
  const [history, setHistory] = useState(false);
  const played = songs.filter((song) => song.end <= now);
  const coming = songs.filter((song) => song.end > now);
  const shown = all ? coming : coming.slice(0, FIRST);

  if (!songs.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {played.length ? (
        <button type="button" onClick={() => setHistory(!history)} className="text-[11.5px] font-semibold text-muted hover:text-ink">
          {history ? "Ocultar" : "Ver"} {played.length === 1 ? "la canción que ya sonó" : `las ${played.length} canciones que ya sonaron`}
        </button>
      ) : null}
      {history ? (
        <ol className="space-y-0.5 opacity-60">
          {played.map((song) => (
            <SongLine key={song.id} song={song} now={now} />
          ))}
        </ol>
      ) : null}
      <ol className="space-y-0.5">
        {shown.map((song) => (
          <SongLine key={song.id} song={song} now={now} />
        ))}
      </ol>
      {coming.length > FIRST ? (
        <button type="button" onClick={() => setAll(!all)} className="text-[11.5px] font-semibold text-ink underline-offset-2 hover:underline">
          {all ? "Mostrar menos" : `Ver las ${coming.length} canciones que siguen`}
        </button>
      ) : null}
    </div>
  );
}

function SongLine({ song, now }: { song: ProgramItem; now: number }) {
  const playing = song.start <= now && now < song.end;
  return (
    <li className={`grid grid-cols-[3.6rem_minmax(0,1fr)_auto] items-baseline gap-2 rounded-lg px-2 py-1 text-[12.5px] ${playing ? "bg-emerald-50" : ""}`}>
      <span className="font-mono text-[11px] tabular-nums text-muted">{clock(song.start)}</span>
      <span className="min-w-0 truncate">
        {playing ? <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Al aire</span> : null}
        <span className="font-semibold text-ink">{song.title}</span>
        {song.artist ? <span className="text-muted"> · {song.artist}</span> : null}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted">{duration((song.end - song.start) / 1000)}</span>
    </li>
  );
}

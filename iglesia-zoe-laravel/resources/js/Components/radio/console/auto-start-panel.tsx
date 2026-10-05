import { useMemo, useState } from "react";
import { duration, shortTitle, type RadioPlaylist, type RadioTrack } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

/** Songs this short are jingles, not music (as the automatic music sees them). */
const MIN_SECONDS = 5;

/**
 * «Iniciar modo automático»: what the automatic music plays (a list or random songs) and the
 * song it starts with. It is heard by every listener within seconds; the song on air fades out
 * under it.
 */
export function AutoStartPanel({ api, playlists, library }: { api: ConsoleApi; playlists: RadioPlaylist[]; library: RadioTrack[] }) {
  const { autopilot, config, state, now } = api;
  const [playlist, setPlaylist] = useState(autopilot.playlist ?? playlists[0]?.id ?? "");
  const [shuffle, setShuffle] = useState(autopilot.playlist ? autopilot.shuffle : false);
  const [pick, setPick] = useState({ list: "", id: "" });
  const first = pick.list === playlist ? pick.id : "";
  const [busy, setBusy] = useState(false);
  const list = playlists.find((item) => item.id === playlist) ?? null;
  const cut = Boolean(state.live.cut);
  const running = config.on_air && config.autofill && !cut;
  const current = state.queue.find((item) => item.start <= now && now < item.end) ?? null;
  const automatic = current && current.kind === "musica" && !current.slot && !current.block ? current : null;

  const songs = useMemo(() => {
    const playable = (track: RadioTrack | undefined): track is RadioTrack => Boolean(track && track.kind === "musica" && track.active && !track.problem && track.duration >= MIN_SECONDS);
    if (!list) return library.filter(playable).sort((a, b) => a.title.localeCompare(b.title));
    const byId = new Map(library.map((track) => [track.id, track]));
    return (list.tracks ?? []).map((id) => byId.get(id)).filter(playable);
  }, [list, library]);

  const chosen = songs.find((track) => track.id === first) ?? null;
  const opening = chosen ?? (list && !shuffle ? (songs[0] ?? null) : null);
  const empty = list ? songs.length === 0 : false;

  async function start() {
    if (cut && !window.confirm("Estás al aire en vivo. ¿Volver a la música automática ahora?")) return;
    setBusy(true);
    await api.startAutopilot(playlist, shuffle, first);
    setBusy(false);
  }

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Modo automático</p>
        <span className="cx-badge" data-tone={running ? "green" : undefined}>
          {running ? "Sonando" : cut ? "En vivo" : !config.on_air ? "Fuera del aire" : "En pausa"}
        </span>
      </div>

      <p className="mt-1 truncate text-[11.5px] leading-4 text-white/50" title={automatic?.title}>
        {running && automatic ? (
          <>
            Ahora: <span className="text-white/85">{shortTitle(automatic.title, 48)}</span> · {autopilot.label}
          </>
        ) : running ? (
          `Sigue: ${autopilot.label}`
        ) : (
          "Elige la lista y la canción de partida."
        )}
      </p>

      <div className="mt-2 space-y-1.5">
        <div className="flex gap-1.5">
          <select value={playlist} onChange={(event) => setPlaylist(event.target.value)} className="cx-select min-w-0 flex-1" aria-label="Qué suena en automático">
            {playlists.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.count} {item.count === 1 ? "canción" : "canciones"}
              </option>
            ))}
            <option value="">Canciones aleatorias (todas)</option>
          </select>
          {list ? (
            <div className="cx-seg !h-[1.9rem]" role="radiogroup" aria-label="Orden">
              {(
                [
                  [false, "En orden", "Como están en la lista, desde la canción de partida"],
                  [true, "Aleatorio", "Empieza con la canción de partida y sigue en orden aleatorio"],
                ] as const
              ).map(([value, label, hint]) => (
                <button key={label} type="button" role="radio" aria-checked={shuffle === value} data-on={shuffle === value || undefined} title={hint} onClick={() => setShuffle(value)}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Punto de partida</span>
          <select value={first} onChange={(event) => setPick({ list: playlist, id: event.target.value })} disabled={empty} className="cx-select w-full" aria-label="Canción con la que empieza">
            <option value="">{list && !shuffle ? `Desde la primera${songs[0] ? ` · ${songs[0].title}` : ""}` : "Cualquiera (al azar)"}</option>
            {songs.map((track, index) => (
              <option key={track.id} value={track.id}>
                {list ? `${index + 1}. ` : ""}
                {track.title}
                {track.artist ? ` — ${track.artist}` : ""} ({duration(track.duration)})
              </option>
            ))}
          </select>
        </label>

        {empty ? (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11.5px] leading-4 text-amber-100">
            Esta lista no tiene canciones. Sube canciones a la Biblioteca y agrégalas en{" "}
            <a href="/admin/radio/listas" className="font-semibold underline">Listas</a>.
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy || empty || (!list && !songs.length)}
          onClick={start}
          className="cx-btn w-full justify-center !py-2.5"
          data-tone="green"
          title="Suena para todos los oyentes en unos segundos; la canción al aire se desvanece debajo"
        >
          {busy ? "Iniciando…" : running ? `Empezar ahora${opening ? ` · ${shortTitle(opening.title, 26)}` : ""}` : "Iniciar modo automático"}
        </button>
        <p className="text-[10.5px] leading-4 text-white/35">
          Al aire suenan las canciones de la Biblioteca.
        </p>
      </div>
    </div>
  );
}

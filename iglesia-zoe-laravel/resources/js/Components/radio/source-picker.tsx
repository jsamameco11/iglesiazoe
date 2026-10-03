import { useRef } from "react";
import { input } from "@/Components/admin/ui";
import { longDuration, type RadioPlaylist } from "@/lib/radio";

const RANDOM_HINT = "Mezcla las canciones de todas tus listas y de la música continua, sin repetir hasta completar la vuelta";

/** What the automatic music continues with, in words: «Lista «Alabanza» · en orden» or «Canciones aleatorias». */
export function sourceLabel(playlists: RadioPlaylist[], playlist: string, shuffle: boolean) {
  const list = playlists.find((item) => item.id === playlist);
  return list ? `Lista «${list.name}» · ${shuffle ? "aleatorio" : "en orden"}` : "Canciones aleatorias";
}

/**
 * What the automatic music plays: one of your playlists (shuffled or in its order) or random
 * songs. `playlist` is the list id, or "" for random songs.
 */
export function SourcePicker({
  playlists,
  playlist,
  shuffle,
  onPlaylist,
  onShuffle,
  studio = false,
}: {
  playlists: RadioPlaylist[];
  playlist: string;
  shuffle: boolean;
  onPlaylist: (value: string) => void;
  onShuffle: (value: boolean) => void;
  studio?: boolean;
}) {
  const lastList = useRef(playlist);
  if (playlist) lastList.current = playlist;
  const isList = playlist !== "";

  function chooseList() {
    const remembered = playlists.some((item) => item.id === lastList.current) ? lastList.current : (playlists[0]?.id ?? "");
    if (remembered) onPlaylist(remembered);
  }

  const sources = [
    [true, "Lista de reproducción", "Una de tus listas, en aleatorio o en su orden"],
    [false, "Canciones aleatorias", RANDOM_HINT],
  ] as const;
  const orders = [
    [true, "Aleatorio", "Todas las canciones una vez, en un orden nuevo cada vuelta"],
    [false, "En orden", "Como están en la lista; al terminar empieza de nuevo"],
  ] as const;

  const segment = (on: boolean) =>
    studio ? undefined : `rounded-lg px-2 py-1.5 text-[12px] font-semibold transition disabled:opacity-40 ${on ? "bg-ink text-white" : "text-muted hover:text-ink"}`;
  const segments = studio ? "cx-seg !h-[1.75rem]" : "grid grid-cols-2 gap-1 rounded-xl bg-paper p-1";

  const sourceSwitch = (
    <div className={segments} role="radiogroup" aria-label="Qué suena en automático">
      {sources.map(([value, label, hint]) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={isList === value}
          title={value && !playlists.length ? "Primero crea una lista en Biblioteca › Listas" : hint}
          disabled={value && !playlists.length}
          onClick={() => (value ? chooseList() : onPlaylist(""))}
          className={segment(isList === value)}
          data-on={studio && isList === value ? "" : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const listSelect = (
    <select value={playlist} onChange={(event) => onPlaylist(event.target.value)} className={studio ? "cx-select w-full" : input} aria-label="Lista de reproducción">
      {playlists.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} · {item.count} {item.count === 1 ? "canción" : "canciones"}
          {item.seconds ? ` · ${longDuration(item.seconds)}` : ""}
        </option>
      ))}
    </select>
  );

  const orderSwitch = (
    <div className={segments} role="radiogroup" aria-label="Orden de la lista">
      {orders.map(([value, label, hint]) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={shuffle === value}
          title={hint}
          onClick={() => onShuffle(value)}
          className={segment(shuffle === value)}
          data-on={studio && shuffle === value ? "" : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const noLists = playlists.length ? null : (
    <p className={studio ? "text-[11px] leading-4 text-white/45" : "text-[11.5px] leading-4 text-muted"}>
      Aún no tienes listas.{" "}
      <a href="/admin/radio/listas" className={studio ? "font-semibold text-white/75 underline" : "font-semibold text-ink underline"}>
        Crea una en Biblioteca › Listas
      </a>{" "}
      para elegirla aquí.
    </p>
  );

  if (studio) {
    return (
      <div className="grid gap-1.5">
        <div className="grid gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          {sourceSwitch}
          {isList ? listSelect : <p className="truncate text-[11.5px] text-white/50" title={RANDOM_HINT}>{RANDOM_HINT}.</p>}
          {isList ? orderSwitch : null}
        </div>
        {noLists}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div>
        <p className="mb-1 text-xs font-semibold text-muted">Qué suena</p>
        {sourceSwitch}
      </div>
      {isList ? (
        <>
          <label className="text-xs font-semibold text-muted">
            Lista de reproducción
            {listSelect}
          </label>
          {orderSwitch}
          <p className="text-[11.5px] leading-4 text-muted">{orders.find(([value]) => value === shuffle)?.[2]}.</p>
        </>
      ) : (
        <p className="text-[11.5px] leading-4 text-muted">{RANDOM_HINT}.</p>
      )}
      {noLists}
    </div>
  );
}

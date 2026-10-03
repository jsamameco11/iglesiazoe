import { input } from "@/Components/admin/ui";
import { longDuration, type RadioPlaylist } from "@/lib/radio";

/** What the automatic music plays: one playlist or all of them, shuffled or in the list's order. */
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
  const modes = [
    [true, "Aleatorio", "Todas las canciones una vez, en un orden nuevo cada vuelta"],
    [false, "En orden", "Como están en la lista; al terminar empieza de nuevo"],
  ] as const;

  const select = (
    <select value={playlist} onChange={(event) => onPlaylist(event.target.value)} className={studio ? "cx-select w-full" : input} aria-label="Lista de reproducción">
      <option value="">Todas las listas (y la música continua)</option>
      {playlists.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} · {item.count} {item.count === 1 ? "canción" : "canciones"}
          {item.seconds ? ` · ${longDuration(item.seconds)}` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className={studio ? "grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto]" : "grid gap-2"}>
      {studio ? (
        select
      ) : (
        <label className="text-xs font-semibold text-muted">
          Lista de reproducción
          {select}
        </label>
      )}
      <div className={studio ? "cx-seg !h-[1.75rem]" : "grid grid-cols-2 gap-1 rounded-xl bg-paper p-1"} role="radiogroup" aria-label="Orden">
        {modes.map(([value, label, hint]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={shuffle === value}
            title={hint}
            onClick={() => onShuffle(value)}
            className={studio ? undefined : `rounded-lg px-2 py-1.5 text-[12px] font-semibold transition ${shuffle === value ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            data-on={studio && shuffle === value ? "" : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      {studio ? null : <p className="text-[11.5px] leading-4 text-muted">{modes.find(([value]) => value === shuffle)?.[2]}.</p>}
    </div>
  );
}

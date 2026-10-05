import { useRef } from "react";
import { input } from "@/Components/admin/ui";
import { clock, longDuration, type Autopilot, type RadioPlaylist } from "@/lib/radio";

const RANDOM_HINT = "Mezcla las canciones de todas tus listas y de la música continua, sin repetir hasta completar la vuelta; si no hay, toda la biblioteca";

/** What the operator should know when the automatic music is on a fallback, or files left the air. */
function fallbackMessages(autopilot: Autopilot) {
  const messages: string[] = [];
  if (autopilot.level === "library") {
    messages.push("Tus listas no tienen canciones disponibles: las canciones aleatorias salen de toda la biblioteca.");
  } else if (autopilot.level === "none") {
    messages.push(
      autopilot.playlist
        ? "La lista elegida no tiene canciones disponibles: los espacios libres quedan en silencio. Agrégale canciones en Listas o elige otra."
        : "No hay canciones disponibles: los espacios libres quedan en silencio. Sube música en Biblioteca.",
    );
  }
  const broken = autopilot.broken ?? 0;
  if (broken > 0) {
    messages.push(`${broken} ${broken === 1 ? "audio salió" : "audios salieron"} del aire porque su archivo no se pudo reproducir. Revísalos en Biblioteca y vuelve a subirlos.`);
  }
  return messages;
}

/** Warns when the automatic music sounds from a fallback level or audios were taken off the air. */
export function FallbackNotice({ autopilot, studio = false }: { autopilot: Autopilot; studio?: boolean }) {
  const messages = fallbackMessages(autopilot);
  if (!messages.length) return null;
  return (
    <div
      role="status"
      className={studio ? "rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11.5px] leading-4 text-amber-100" : "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-900"}
    >
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

/** A scheduled change of the automatic music: when it starts, what plays until then, and a way to call it off. */
export function PendingSwitch({ autopilot, now, busy, onCancel, studio = false }: { autopilot: Autopilot; now: number; busy?: boolean; onCancel: () => void; studio?: boolean }) {
  if (!autopilot.pending || autopilot.since <= now) return null;
  const left = Math.max(0, Math.round((autopilot.since - now) / 1000));
  const countdown = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <div
      role="status"
      className={
        studio
          ? "flex flex-wrap items-center gap-2 rounded-md border border-sky-400/30 bg-sky-400/10 px-2.5 py-1.5 text-[11.5px] leading-4 text-sky-100"
          : "flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-5 text-sky-900"
      }
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Cambio programado:</span> {autopilot.label} a las {clock(autopilot.since)}{" "}
        <span className="tabular-nums">(en {countdown})</span>, al terminar la canción, sin cortes. Hasta entonces sigue {autopilot.pending.label}.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className={studio ? "cx-btn !py-1" : "rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-sky-900 transition hover:bg-sky-100 disabled:opacity-50"}
      >
        Cancelar cambio
      </button>
    </div>
  );
}

/** What the automatic music continues with, in words: «Lista «Alabanza» · en orden» or «Canciones aleatorias». */
export function sourceLabel(playlists: RadioPlaylist[], playlist: string, shuffle: boolean) {
  const list = playlists.find((item) => item.id === playlist);
  return list ? `Lista «${list.name}» · ${shuffle ? "aleatorio" : "en orden"}` : "Canciones aleatorias";
}

/** Seconds as «5 min», «30 s» or «1 min 30 s». */
export function leadLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return `${rest} s`;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

type Mode = "list" | "random";

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
  const mode: Mode = playlist !== "" ? "list" : "random";
  const isList = mode === "list";

  function chooseList() {
    const remembered = playlists.some((item) => item.id === lastList.current) ? lastList.current : (playlists[0]?.id ?? "");
    if (remembered) onPlaylist(remembered);
  }

  function choose(next: Mode) {
    if (next === "list") chooseList();
    else onPlaylist("");
  }

  const sources: readonly (readonly [Mode, string, string, boolean])[] = [
    ["list", "Lista de reproducción", playlists.length ? "Una de tus listas, en aleatorio o en su orden" : "Primero crea una lista en Biblioteca › Listas", !playlists.length],
    ["random", "Canciones aleatorias", RANDOM_HINT, false],
  ];
  const orders = [
    [true, "Aleatorio", "Todas las canciones una vez, en un orden nuevo cada vuelta"],
    [false, "En orden", "Como están en la lista, de la primera a la última"],
  ] as const;

  const segment = (on: boolean) =>
    studio ? undefined : `rounded-lg px-2 py-1.5 text-[12px] font-semibold transition disabled:opacity-40 ${on ? "bg-ink text-white" : "text-muted hover:text-ink"}`;
  const segments = studio ? "cx-seg !h-[1.75rem]" : "grid gap-1 rounded-xl bg-paper p-1";
  const orderSegments = studio ? segments : "grid grid-cols-2 gap-1 rounded-xl bg-paper p-1";

  const sourceSwitch = (
    <div className={segments} style={studio ? undefined : { gridTemplateColumns: `repeat(${sources.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Qué suena en automático">
      {sources.map(([value, label, hint, disabled]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          title={hint}
          disabled={disabled}
          onClick={() => choose(value)}
          className={segment(mode === value)}
          data-on={studio && mode === value ? "" : undefined}
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
    <div className={orderSegments} role="radiogroup" aria-label="Orden de la lista">
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
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {sourceSwitch}
        {isList ? <div className="w-[13rem] max-w-full">{listSelect}</div> : null}
        {isList ? orderSwitch : null}
        {playlists.length ? null : (
          <a href="/admin/radio/listas" className="text-[11px] font-semibold text-white/50 transition hover:text-white" title="Aún no tienes listas: crea una en Biblioteca › Listas para elegirla aquí">
            + Crear lista
          </a>
        )}
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

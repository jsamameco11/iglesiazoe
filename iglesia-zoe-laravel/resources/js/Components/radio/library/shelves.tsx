import { useState } from "react";
import { MusicNote, plain } from "@/Components/radio/library/song-fields";
import { input } from "@/Components/admin/ui";
import { longDuration, type RadioTrack } from "@/lib/radio";

/** How the library is browsed: every audio, the songs of each author, or the songs of each style. */
export type LibraryView = "audios" | "autores" | "estilos";

/** An author or a style with its songs: `main` are those where the author is the main one (all, for a style). */
export type Shelf = { key: string; name: string; family?: string; songs: RadioTrack[]; main: number; seconds: number; covers: string[]; tags: string[] };

const small = `${input} !mt-0 !py-2`;
const NO_STYLE = "sin-estilo";

function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

/** The names that come up most among the songs, most frequent first. */
function mostCommon(names: string[], limit: number) {
  const tally = new Map<string, { name: string; times: number }>();
  for (const name of names) {
    const entry = tally.get(plain(name)) ?? { name, times: 0 };
    entry.times++;
    tally.set(plain(name), entry);
  }
  return [...tally.values()].sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, "es")).slice(0, limit).map((entry) => entry.name);
}

function shelf(key: string, name: string, songs: RadioTrack[], main: number, tags: string[], family?: string): Shelf {
  return {
    key,
    name,
    family,
    songs,
    main,
    seconds: songs.reduce((sum, track) => sum + track.duration, 0),
    covers: [...new Set(songs.map((track) => track.cover).filter((cover): cover is string => Boolean(cover)))].slice(0, 4),
    tags,
  };
}

/** Each author with the songs they sing, as main author or as a guest; the same name written alike counts once. */
export function artistShelves(songs: RadioTrack[]): Shelf[] {
  const found = new Map<string, { name: string; songs: RadioTrack[]; main: number }>();
  for (const track of songs) {
    const credits = [track.artist ?? "", ...(track.featured ?? [])].map((name) => name.trim()).filter(Boolean);
    credits.forEach((name, index) => {
      const key = plain(name);
      const entry = found.get(key) ?? { name, songs: [], main: 0 };
      if (entry.songs.includes(track)) return;
      entry.songs.push(track);
      if (index === 0) entry.main++;
      found.set(key, entry);
    });
  }
  return [...found.entries()].map(([key, entry]) =>
    shelf(key, entry.name, entry.songs, entry.main, mostCommon(entry.songs.flatMap((track) => (track.genres ?? []).map((genre) => genre.name)), 2)),
  );
}

/** Each musical style with its songs, and the songs still without a style apart. */
export function styleShelves(songs: RadioTrack[]): Shelf[] {
  const found = new Map<string, { name: string; family: string; songs: RadioTrack[] }>();
  for (const track of songs) {
    for (const genre of track.genres ?? []) {
      const entry = found.get(genre.id) ?? { name: genre.name, family: genre.family, songs: [] };
      entry.songs.push(track);
      found.set(genre.id, entry);
    }
  }
  const authors = (list: RadioTrack[]) => mostCommon(list.map((track) => track.artist ?? "").filter(Boolean), 3);
  const shelves = [...found.entries()].map(([key, entry]) => shelf(key, entry.name, entry.songs, entry.songs.length, authors(entry.songs), entry.family));
  const loose = songs.filter((track) => !track.genres?.length);
  return loose.length ? [...shelves, shelf(NO_STYLE, "Sin estilo asignado", loose, loose.length, authors(loose))] : shelves;
}

/** The authors or styles as cards to open: sorted by songs or by name, styles grouped by family. */
export function ShelfBrowser({
  view,
  shelves,
  families,
  query,
  onQuery,
  onOpen,
}: {
  view: Exclude<LibraryView, "audios">;
  shelves: Shelf[];
  families: Record<string, string>;
  query: string;
  onQuery: (query: string) => void;
  onOpen: (key: string) => void;
}) {
  const [order, setOrder] = useState<"songs" | "name">("songs");
  const [family, setFamily] = useState("");
  const authors = view === "autores";
  const needle = plain(query.trim());
  const shown = shelves
    .filter((item) => (!family || item.family === family) && (!needle || plain(`${item.name} ${item.tags.join(" ")}`).includes(needle)))
    .sort((a, b) => (order === "songs" ? b.songs.length - a.songs.length : 0) || a.name.localeCompare(b.name, "es"));
  const usedFamilies = Object.entries(families).filter(([key]) => shelves.some((item) => item.family === key));
  const groups = authors
    ? order === "name"
      ? [...new Set(shown.map((item) => initial(item.name)))].map((letter) => ({ key: letter, label: letter, items: shown.filter((item) => initial(item.name) === letter) }))
      : [{ key: "all", label: "", items: shown }]
    : [
        ...usedFamilies.map(([key, label]) => ({ key, label, items: shown.filter((item) => item.family === key) })),
        { key: NO_STYLE, label: "Por clasificar", items: shown.filter((item) => item.key === NO_STYLE) },
      ].filter((group) => group.items.length);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={authors ? "Buscar autor o agrupación…" : "Buscar estilo…"}
          className={`${small} min-w-0 flex-1 sm:!w-72 sm:flex-none`}
        />
        {!authors && usedFamilies.length > 1 ? (
          <select value={family} onChange={(event) => setFamily(event.target.value)} className={`${small} !w-auto`} aria-label="Filtrar por familia">
            <option value="">Todas las familias</option>
            {usedFamilies.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : null}
        <select value={order} onChange={(event) => setOrder(event.target.value as "songs" | "name")} className={`${small} !w-auto sm:ml-auto`} aria-label="Ordenar">
          <option value="songs">Con más canciones primero</option>
          <option value="name">Por nombre (A–Z)</option>
        </select>
      </div>

      {groups.length === 0 ? (
        <p className="mt-5 rounded-[1.4rem] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          {shelves.length === 0 ? (authors ? "Aún no hay canciones con autor." : "Aún no hay canciones.") : authors ? "No hay autores con ese nombre." : "No hay estilos con ese nombre."}
        </p>
      ) : null}
      {groups.map((group) => (
        <div key={group.key} className="mt-5">
          {group.label ? (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              {group.label} · {group.items.length}
            </h2>
          ) : null}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onOpen(item.key)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2.5 text-left transition hover:border-ink/25 hover:shadow-[0_10px_28px_-18px_rgba(20,20,20,0.45)]"
                >
                  <Artwork covers={item.covers} name={item.name} round={authors} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] font-semibold ${item.key === NO_STYLE ? "text-amber-800" : ""}`}>{item.name}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{summary(item, authors)}</span>
                    {item.tags.length ? <span className="mt-0.5 block truncate text-[11px] text-muted/80">{item.tags.join(" · ")}</span> : null}
                  </span>
                  <span className="pr-1 text-muted" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The top of an open author or style: back to every card, its picture, and what it holds. */
export function ShelfHeader({ view, shelf: item, families, onBack }: { view: Exclude<LibraryView, "audios">; shelf: Shelf; families: Record<string, string>; onBack: () => void }) {
  const authors = view === "autores";
  const kicker = authors ? (item.main === item.songs.length ? "Autor" : item.main ? "Autor e invitado" : "Invitado") : item.family ? (families[item.family] ?? "Estilo") : "Por clasificar";

  return (
    <div className="mt-4">
      <button type="button" onClick={onBack} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">
        ← {authors ? "Todos los autores" : "Todos los estilos"}
      </button>
      <div className="mt-2 flex items-center gap-4 rounded-2xl bg-paper p-4">
        <Artwork covers={item.covers} name={item.name} round={authors} size="h-20 w-20" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{kicker}</p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-[-0.02em]">{item.name}</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            {summary(item, authors)}
            {item.tags.length ? ` · ${authors ? "" : "Sobre todo "}${item.tags.join(", ")}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/** «5 canciones · 2 como invitado · 23 min» */
function summary(item: Shelf, authors: boolean) {
  const guest = item.songs.length - item.main;
  return [count(item.songs.length, "canción", "canciones"), authors && guest ? `${guest} como invitado` : "", longDuration(item.seconds)].filter(Boolean).join(" · ");
}

function initial(name: string) {
  const letter = plain(name).match(/[a-z]/)?.[0];
  return letter ? letter.toUpperCase() : "#";
}

/** Up to four covers of the songs; without covers, the initials of an author or a note for a style. */
function Artwork({ covers, name, round, size = "h-14 w-14" }: { covers: string[]; name: string; round: boolean; size?: string }) {
  const shape = `${size} shrink-0 overflow-hidden ${round ? "rounded-full" : "rounded-xl"} bg-paper`;
  if (covers.length >= 4) {
    return (
      <span className={`${shape} grid grid-cols-2 grid-rows-2`}>
        {covers.map((cover) => (
          <img key={cover} src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ))}
      </span>
    );
  }
  if (covers.length) {
    return (
      <span className={shape}>
        <img src={covers[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }
  const letters = name
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.match(/\p{L}/u)?.[0]?.toUpperCase())
    .join("");
  return (
    <span className={`${shape} grid place-items-center border border-line text-muted`}>
      {round && letters ? <span className="text-sm font-semibold tracking-wide">{letters}</span> : <MusicNote className="h-5 w-5" />}
    </span>
  );
}

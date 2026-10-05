import { useState, type FormEvent } from "react";
import { RadioHeader } from "@/Components/radio/admin-ui";
import { GenrePicker, plain } from "@/Components/radio/library/song-fields";
import { Notice, Stat, button, ghost, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send } from "@/lib/actions";
import type { RadioGenre } from "@/lib/radio";
import "../../../../css/radio.css";

type Genre = RadioGenre & { aliases: string[]; custom: boolean; songs: number; artists: number };

type Artist = {
  id: string;
  name: string;
  aliases: string[];
  kind: string | null;
  country: string | null;
  convert: boolean;
  source: string;
  genres: string[];
  songs: number;
};

type Props = {
  genres: Genre[];
  artists: Artist[];
  families: Record<string, string>;
  kinds: Record<string, string>;
  sources: Record<string, string>;
  maxGenres: number;
};

const CATALOG = "/admin/radio/catalogo";
const small = `${input} !mt-0 !py-2`;
const NEW = "nuevo";

function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

export default function Catalogo({ genres, artists, families, kinds, sources, maxGenres }: Props) {
  const [tab, setTab] = useState<"genres" | "artists">("genres");
  const custom = genres.filter((genre) => genre.custom).length;
  const learned = artists.filter((artist) => artist.source === "aprendido").length;

  return (
    <AdminLayout>
      <RadioHeader
        title="Catálogo musical"
        text="Los estilos musicales y los artistas con los que se clasifica cada canción. Al subir una canción la buscamos en internet y la conectamos sola con su autor, sus coautores y sus estilos; aquí puedes corregirlos, agregar nuevos y ver cuántas canciones tiene cada uno."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Estilos musicales" value={genres.length} note={custom ? `${custom} agregados por ustedes` : `En ${Object.keys(families).length} familias`} />
        <Stat label="Estilos en uso" value={genres.filter((genre) => genre.songs).length} note="Con al menos una canción" tone="bg-[#f4efe6]" />
        <Stat label="Artistas y agrupaciones" value={artists.length} note={learned ? `${learned} aprendidos al subir canciones` : undefined} />
        <Stat label="Convertidos" value={artists.filter((artist) => artist.convert).length} note="Artistas que llegaron a la fe" />
      </div>

      <section className="mt-6 rounded-[1.6rem] border border-line bg-card p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["genres", `Estilos musicales · ${genres.length}`],
              ["artists", `Artistas · ${artists.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${tab === key ? "bg-ink text-white" : "bg-paper text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "genres" ? <GenreList genres={genres} families={families} /> : <ArtistList artists={artists} genres={genres} families={families} kinds={kinds} sources={sources} maxGenres={maxGenres} />}
      </section>
    </AdminLayout>
  );
}

function GenreList({ genres, families }: { genres: Genre[]; families: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const needle = plain(query.trim());
  const shown = genres.filter((genre) => (!family || genre.family === family) && (!needle || plain([genre.name, ...genre.aliases].join(" ")).includes(needle)));
  const groups = Object.entries(families)
    .map(([key, label]) => ({ key, label, genres: shown.filter((genre) => genre.family === key) }))
    .filter((group) => group.genres.length);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar estilo o nombre alternativo…" className={`${small} min-w-0 flex-1 sm:!w-72 sm:flex-none`} />
        <select value={family} onChange={(event) => setFamily(event.target.value)} className={`${small} !w-auto`} aria-label="Filtrar por familia">
          <option value="">Todas las familias</option>
          {Object.entries(families).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setEditing(editing === NEW ? null : NEW)} className={`${button} ml-auto !py-2`}>
          + Nuevo estilo
        </button>
      </div>

      {editing === NEW ? <GenreForm families={families} defaultFamily={family || "cristiana"} onDone={() => setEditing(null)} /> : null}

      {groups.length === 0 ? <p className="mt-5 rounded-[1.4rem] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">No hay estilos con ese nombre.</p> : null}
      {groups.map((group) => (
        <div key={group.key} className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {group.label} · {group.genres.length}
          </h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.genres.map((genre) =>
              editing === genre.id ? (
                <li key={genre.id} className="sm:col-span-2 xl:col-span-3">
                  <GenreForm genre={genre} families={families} defaultFamily={genre.family} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <GenreRow key={genre.id} genre={genre} onEdit={() => setEditing(genre.id)} />
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GenreRow({ genre, onEdit }: { genre: Genre; onEdit: () => void }) {
  const { result, setResult, pending, run } = useAction();

  function remove() {
    const used = [genre.songs ? count(genre.songs, "canción", "canciones") : "", genre.artists ? count(genre.artists, "artista", "artistas") : ""].filter(Boolean).join(" y ");
    if (!window.confirm(`¿Eliminar el estilo «${genre.name}»?${used ? ` Se quitará de ${used}.` : ""}`)) return;
    run(() => send(`${CATALOG}/genero/eliminar`, { id: genre.id }));
  }

  return (
    <li className="rounded-2xl border border-line bg-white px-3.5 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
            {genre.name}
            {genre.custom ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">Agregado</span> : null}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {genre.songs || genre.artists ? [genre.songs ? count(genre.songs, "canción", "canciones") : "", genre.artists ? count(genre.artists, "artista", "artistas") : ""].filter(Boolean).join(" · ") : "Sin canciones aún"}
          </p>
          {genre.aliases.length ? (
            <p className="mt-1 truncate text-[11px] text-muted/80" title={genre.aliases.join(", ")}>
              También: {genre.aliases.join(", ")}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onEdit} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-paper hover:text-ink">
          Editar
        </button>
        <button type="button" disabled={pending} onClick={remove} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-50">
          Eliminar
        </button>
      </div>
      {result?.error ? (
        <div className="mt-2">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      ) : null}
    </li>
  );
}

function GenreForm({ genre, families, defaultFamily, onDone }: { genre?: Genre; families: Record<string, string>; defaultFamily: string; onDone: () => void }) {
  const { result, setResult, pending, run } = useAction();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (genre) data.set("id", genre.id);
    run(() => send(`${CATALOG}/genero`, data), onDone);
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_14rem]">
      <label className="text-xs font-semibold text-muted">
        Nombre del estilo <span className="text-red-600">*</span>
        <input name="name" defaultValue={genre?.name} required minLength={2} maxLength={60} placeholder="Ej.: Pop rock alternativo" className={input} autoFocus />
      </label>
      <label className="text-xs font-semibold text-muted">
        Familia
        <select name="family" defaultValue={defaultFamily} className={input}>
          {Object.entries(families).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted md:col-span-2">
        Otros nombres <span className="font-normal">(separados por comas; así lo reconocemos cuando internet lo escribe distinto, por ejemplo en inglés)</span>
        <textarea name="aliases" defaultValue={genre?.aliases.join(", ")} rows={2} maxLength={1000} placeholder="alternative pop rock, pop rock alternativo" className={`${input} resize-none`} />
      </label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <button disabled={pending} className={`${button} !py-2`}>
          {pending ? "Guardando…" : genre ? "Guardar cambios" : "Agregar estilo"}
        </button>
        <button type="button" onClick={onDone} className={`${ghost} !py-2`}>
          Cancelar
        </button>
        <div className="w-full">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      </div>
    </form>
  );
}

function ArtistList({
  artists,
  genres,
  families,
  kinds,
  sources,
  maxGenres,
}: {
  artists: Artist[];
  genres: Genre[];
  families: Record<string, string>;
  kinds: Record<string, string>;
  sources: Record<string, string>;
  maxGenres: number;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [source, setSource] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const byId = new Map(genres.map((genre) => [genre.id, genre]));
  const needle = plain(query.trim());
  const shown = artists.filter(
    (artist) =>
      (!kind || (kind === "convert" ? artist.convert : artist.kind === kind)) &&
      (!source || artist.source === source) &&
      (!needle ||
        plain([artist.name, ...artist.aliases, artist.country ?? "", ...artist.genres.map((id) => byId.get(id)?.name ?? "")].join(" ")).includes(needle)),
  );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar artista, país o estilo…" className={`${small} min-w-0 flex-1 sm:!w-72 sm:flex-none`} />
        <select value={kind} onChange={(event) => setKind(event.target.value)} className={`${small} !w-auto`} aria-label="Filtrar por tipo">
          <option value="">Solistas y agrupaciones</option>
          {Object.entries(kinds).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value="convert">Convertidos</option>
        </select>
        <select value={source} onChange={(event) => setSource(event.target.value)} className={`${small} !w-auto`} aria-label="Filtrar por origen">
          <option value="">Todos los orígenes</option>
          {Object.entries(sources).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setEditing(editing === NEW ? null : NEW)} className={`${button} ml-auto !py-2`}>
          + Nuevo artista
        </button>
      </div>

      {editing === NEW ? <ArtistForm genres={genres} families={families} kinds={kinds} maxGenres={maxGenres} onDone={() => setEditing(null)} /> : null}

      {shown.length === 0 ? (
        <p className="mt-5 rounded-[1.4rem] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">No hay artistas con ese filtro.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {shown.map((artist) =>
            editing === artist.id ? (
              <li key={artist.id} className="py-2">
                <ArtistForm artist={artist} genres={genres} families={families} kinds={kinds} maxGenres={maxGenres} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <ArtistRow key={artist.id} artist={artist} byId={byId} kinds={kinds} sources={sources} onEdit={() => setEditing(artist.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

const SOURCE_TONE: Record<string, string> = { catalogo: "bg-paper text-ink/70", aprendido: "bg-blue-50 text-blue-800", manual: "bg-emerald-50 text-emerald-800" };

function ArtistRow({ artist, byId, kinds, sources, onEdit }: { artist: Artist; byId: Map<string, Genre>; kinds: Record<string, string>; sources: Record<string, string>; onEdit: () => void }) {
  const { result, setResult, pending, run } = useAction();

  function remove() {
    if (!window.confirm(`¿Eliminar a «${artist.name}» del catálogo? Sus canciones siguen en la biblioteca.`)) return;
    run(() => send(`${CATALOG}/artista/eliminar`, { id: artist.id }));
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
            {artist.name}
            {artist.convert ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">Convertido</span> : null}
          </p>
          <p className="truncate text-[12px] text-muted">
            {[artist.kind ? kinds[artist.kind] : "", artist.country ?? "", artist.songs ? count(artist.songs, "canción", "canciones") : "", artist.aliases.length ? `También: ${artist.aliases.join(", ")}` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {artist.genres.map((id, index) => {
            const genre = byId.get(id);
            return genre ? (
              <span key={id} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${index === 0 ? "bg-ink text-white" : "bg-paper text-ink"}`}>
                {genre.name}
              </span>
            ) : null;
          })}
          {artist.genres.length === 0 ? <span className="text-[11px] text-muted">Sin estilos</span> : null}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SOURCE_TONE[artist.source] ?? "bg-paper text-ink/70"}`}>{sources[artist.source] ?? artist.source}</span>
          <button type="button" onClick={onEdit} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">
            Editar
          </button>
          <button type="button" disabled={pending} onClick={remove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">
            Eliminar
          </button>
        </div>
      </div>
      {result?.error ? (
        <div className="mt-2">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      ) : null}
    </li>
  );
}

function ArtistForm({
  artist,
  genres,
  families,
  kinds,
  maxGenres,
  onDone,
}: {
  artist?: Artist;
  genres: Genre[];
  families: Record<string, string>;
  kinds: Record<string, string>;
  maxGenres: number;
  onDone: () => void;
}) {
  const { result, setResult, pending, run } = useAction();
  const [chosen, setChosen] = useState<RadioGenre[]>(() => (artist?.genres ?? []).flatMap((id) => genres.filter((genre) => genre.id === id)));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (artist) data.set("id", artist.id);
    data.set("convert", data.get("convert") ? "1" : "0");
    run(() => send(`${CATALOG}/artista`, data), onDone);
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_12rem_6rem]">
      <label className="text-xs font-semibold text-muted">
        Nombre del artista o agrupación <span className="text-red-600">*</span>
        <input name="name" defaultValue={artist?.name} required maxLength={120} placeholder="Ej.: Montesanto" className={input} autoFocus />
      </label>
      <label className="text-xs font-semibold text-muted">
        Tipo
        <select name="kind" defaultValue={artist?.kind ?? ""} className={input}>
          <option value="">Sin indicar</option>
          {Object.entries(kinds).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        País
        <input name="country" defaultValue={artist?.country ?? ""} maxLength={2} placeholder="PE" className={`${input} uppercase`} title="Código de 2 letras: PE, MX, VE, US…" />
      </label>
      <label className="text-xs font-semibold text-muted md:col-span-3">
        Otros nombres <span className="font-normal">(separados por comas: cómo aparece en los archivos o en internet)</span>
        <input name="aliases" defaultValue={artist?.aliases.join(", ")} maxLength={1000} placeholder="Ej.: Montesanto Oficial" className={input} />
      </label>
      <div className="md:col-span-3">
        <span className="text-xs font-semibold text-muted">
          Estilos musicales <span className="font-normal">(sus canciones se clasifican con ellos; el primero es el principal)</span>
        </span>
        <div className="mt-1.5">
          <GenrePicker value={chosen} onChange={setChosen} genres={genres} families={families} max={maxGenres} name="genre_ids" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-3">
        <input type="checkbox" name="convert" value="1" defaultChecked={artist?.convert} /> Convertido (antes hacía música secular): sus canciones no se marcan como cristianas solo por ser suyas; se respeta lo que internet diga de cada una
      </label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-3">
        <button disabled={pending} className={`${button} !py-2`}>
          {pending ? "Guardando…" : artist ? "Guardar cambios" : "Agregar artista"}
        </button>
        <button type="button" onClick={onDone} className={`${ghost} !py-2`}>
          Cancelar
        </button>
        <div className="w-full">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      </div>
    </form>
  );
}

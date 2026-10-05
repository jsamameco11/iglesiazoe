import { useEffect, useId, useRef, useState } from "react";
import { input } from "@/Components/admin/ui";
import { COVER_ACCEPT } from "@/Components/radio/admin-ui";
import type { RadioGenre, SongIdentity } from "@/lib/radio";
import { send, type ActionResult } from "@/lib/actions";

const small = `${input} !mt-0 !py-2`;

/** Up to `max` co-authors of a song, one per line; `name` adds them to the surrounding form as featured[]. */
export function CoAuthorsField({ value, onChange, max, disabled = false, name }: { value: string[]; onChange: (value: string[]) => void; max: number; disabled?: boolean; name?: string }) {
  const full = value.length >= max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted">
          Coautores <span className="font-normal">(opcional)</span>
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {value.length}/{max}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {value.map((author, index) => (
          <span key={index} className="flex min-w-[9rem] flex-1 items-center gap-1 sm:max-w-[14rem]">
            <input
              value={author}
              disabled={disabled}
              onChange={(event) => onChange(value.map((item, at) => (at === index ? event.target.value : item)))}
              placeholder={`Coautor ${index + 1}`}
              maxLength={120}
              className={small}
              aria-label={`Coautor ${index + 1}`}
            />
            <button type="button" disabled={disabled} onClick={() => onChange(value.filter((_, at) => at !== index))} className="px-1 text-base text-muted hover:text-red-700" aria-label={`Quitar coautor ${index + 1}`}>
              ×
            </button>
            {name && author.trim() ? <input type="hidden" name={`${name}[]`} value={author.trim()} /> : null}
          </span>
        ))}
        {full ? null : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...value, ""])}
            className="rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
          >
            + Agregar coautor
          </button>
        )}
      </div>
    </div>
  );
}

/** «Adoración» and «adoracion» are the same search. */
export function plain(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Musical styles of a song, the main one first, chosen from the catalog grouped by family; `name` adds them to the surrounding form as genre_ids[]. */
export function GenrePicker({
  value,
  onChange,
  genres,
  families,
  max,
  disabled = false,
  name,
}: {
  value: RadioGenre[];
  onChange: (value: RadioGenre[]) => void;
  genres: RadioGenre[];
  families: Record<string, string>;
  max: number;
  disabled?: boolean;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = new Set(value.map((genre) => genre.id));
  const full = value.length >= max;
  const needle = plain(query.trim());
  const groups = Object.entries(families)
    .map(([family, label]) => ({
      family,
      label,
      genres: genres.filter((genre) => genre.family === family && !chosen.has(genre.id) && (!needle || plain(`${genre.name} ${label}`).includes(needle))),
    }))
    .filter((group) => group.genres.length);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => box.current && !box.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function add(genre: RadioGenre) {
    onChange([...value, genre].slice(0, max));
    setQuery("");
    if (value.length + 1 >= max) setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((genre, index) => (
          <span
            key={genre.id}
            className={`inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-[12px] font-semibold ${index === 0 ? "bg-ink text-white" : "bg-paper text-ink"}`}
            title={index === 0 ? "Estilo principal" : families[genre.family]}
          >
            {genre.name}
            {index > 0 && !disabled ? (
              <button type="button" onClick={() => onChange([genre, ...value.filter((item) => item.id !== genre.id)])} className="rounded-full px-1 text-[10px] opacity-60 hover:opacity-100" title="Hacerlo el estilo principal">
                ★
              </button>
            ) : null}
            {disabled ? null : (
              <button type="button" onClick={() => onChange(value.filter((item) => item.id !== genre.id))} className="rounded-full px-1 text-sm leading-none opacity-60 hover:opacity-100" aria-label={`Quitar ${genre.name}`}>
                ×
              </button>
            )}
            {name ? <input type="hidden" name={`${name}[]`} value={genre.id} /> : null}
          </span>
        ))}
        {full || disabled ? null : (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={listId}
            className="rounded-full border border-dashed border-line px-3 py-1 text-xs font-semibold text-muted transition hover:border-ink/30 hover:text-ink"
          >
            + {value.length ? "Otro estilo" : "Elegir estilo musical"}
          </button>
        )}
        {value.length === 0 && disabled ? <span className="text-xs text-muted">Sin estilo</span> : null}
      </div>
      {open ? (
        <div id={listId} className="absolute left-0 z-30 mt-1.5 w-[min(24rem,85vw)] rounded-2xl border border-line bg-white p-2 shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter") {
                event.preventDefault();
                const first = groups[0]?.genres[0];
                if (first) add(first);
              }
            }}
            placeholder="Buscar estilo: pop, rock, adoración, salsa…"
            className={small}
            aria-label="Buscar estilo musical"
          />
          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            {groups.length === 0 ? <p className="px-2 py-4 text-center text-xs text-muted">No hay estilos con ese nombre. Créalo en el Catálogo musical.</p> : null}
            {groups.map((group) => (
              <div key={group.family} className="mb-2">
                <p className="sticky top-0 bg-white px-1 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{group.label}</p>
                <div className="flex flex-wrap gap-1">
                  {group.genres.map((genre) => (
                    <button key={genre.id} type="button" onClick={() => add(genre)} className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-medium text-ink transition hover:bg-ink hover:text-white">
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type LookupState = { status: "searching" } | { status: "found"; result: SongIdentity } | { status: "missing" } | { status: "error"; error: string };

/** Asks the internet (iTunes, Deezer, MusicBrainz, Wikidata) and the catalog who sings a song, its album and its styles. */
export async function identifySong(song: { id?: string; title: string; artist: string; featured: string[]; duration?: number | null; genre?: string }): Promise<LookupState> {
  const response = await send("/admin/radio/biblioteca/identificar", {
    id: song.id,
    title: song.title.trim(),
    artist: song.artist.trim(),
    featured: song.featured.map((name) => name.trim()).filter(Boolean),
    duration: song.duration ? String(song.duration) : undefined,
    genre: song.genre || undefined,
  }).catch((): ActionResult => ({ error: "Sin conexión: no pudimos buscarla en internet." }));
  if (response.error) return { status: "error", error: response.error };
  const result = response.result as SongIdentity | undefined;
  if (!result) return { status: "error", error: "No pudimos buscarla en internet." };
  return result.found || result.genres.length ? { status: "found", result } : { status: "missing" };
}

/** What is saved with the song about where its data came from. */
export function identityJson(result: SongIdentity) {
  const { kind, country, musicbrainz_id } = result.artist_info;
  return JSON.stringify({ ...result.identity, artist: { kind, country, musicbrainz_id } });
}

/** Names of both lists without repeating anyone, keeping the first spelling. */
export function mergeNames(first: string[], second: string[], max: number) {
  const seen = new Set<string>();
  return [...first, ...second]
    .map((name) => name.trim())
    .filter((name) => {
      const key = plain(name).replace(/[^a-z0-9]/g, "");
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

const SOURCE_NAMES: Record<string, string> = { itunes: "Apple Music", deezer: "Deezer", musicbrainz: "MusicBrainz", wikidata: "Wikidata", catalogo: "Catálogo de la radio" };
const KIND_NAMES: Record<string, string> = { solista: "Solista", agrupacion: "Agrupación" };

/** How sure the internet lookup is, with the sources that confirmed it. */
export function LookupBadge({ state }: { state: LookupState | null }) {
  if (!state) return null;
  if (state.status === "searching") return <span className="animate-pulse rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">Buscando en internet…</span>;
  if (state.status === "error") return <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-800" title={state.error}>No se pudo buscar en internet</span>;
  if (state.status === "missing") return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700" title="Ninguna fuente la reconoció con seguridad. Revisa los datos.">No la encontramos en internet</span>;
  const { result } = state;
  const sources = result.sources.map((source) => SOURCE_NAMES[source] ?? source).join(", ");
  const info = result.artist_info;
  const who = [info.kind ? KIND_NAMES[info.kind] : "", info.country ?? "", info.convert ? "convertido" : ""].filter(Boolean).join(" · ");
  const tone = !result.found ? "bg-slate-100 text-slate-700" : result.confidence === "alta" ? "bg-emerald-50 text-emerald-800" : result.confidence === "media" ? "bg-amber-50 text-amber-800" : "bg-orange-50 text-orange-800";
  const text = !result.found ? "Estilo según su autor" : result.confidence === "alta" ? "✓ Identificada en internet" : result.confidence === "media" ? "Identificada · revísala" : "Coincidencia dudosa · revísala";
  return (
    <>
      <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`} title={sources ? `Confirmado por: ${sources}` : undefined}>
        {text}
      </span>
      {who ? <span className="rounded-full bg-paper px-2 py-0.5 font-semibold text-ink/70">{who}</span> : null}
    </>
  );
}

/** Four-digit year, or empty. */
export function cleanYear(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

/** The cover of a song: shows it, changes it with a click and removes it. */
export function CoverPicker({ src, onPick, onRemove, disabled = false, size = "h-20 w-20" }: { src: string | null; onPick: (file: File) => void; onRemove: () => void; disabled?: boolean; size?: string }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => picker.current?.click()}
        className={`group relative grid ${size} place-items-center overflow-hidden rounded-xl border border-line bg-paper text-muted transition hover:border-ink/30`}
        title={src ? "Cambiar carátula" : "Agregar carátula (JPG, PNG o WEBP)"}
      >
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <MusicNote />}
        <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
          {src ? "Cambiar" : "Carátula"}
        </span>
      </button>
      {src ? (
        <button type="button" disabled={disabled} onClick={onRemove} className="text-[10.5px] font-semibold text-muted hover:text-red-700">
          Quitar
        </button>
      ) : null}
      <input
        ref={picker}
        type="file"
        accept={COVER_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function MusicNote({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </svg>
  );
}

import { send } from "@/lib/actions";
import { duration } from "@/lib/radio";

/** A song of the library or of the same upload that the song repeats, with the verdict and what it rests on. */
export type DuplicateMatch = {
  verdict: "misma" | "version" | "posible";
  reasons: string[];
  track?: { id: string; title: string; artist: string | null; album: string | null; year: number | null; duration: number | null; cover: string | null };
  /** Key of an earlier song of the same upload. */
  batch?: string;
};

/** Not reviewed yet (null), reviewed (the matches, maybe none) or the review could not be done. */
export type DuplicateReview = DuplicateMatch[] | null | "error";

export type SongToReview = { key: string; title: string; artist: string; featured: string[]; album: string; year: string; duration: number | null; identity: string | null };

/** Asks which songs of an upload repeat a song of the library or an earlier song of the same upload; null when it could not ask. */
export async function reviewDuplicates(songs: SongToReview[]): Promise<Record<string, DuplicateMatch[]> | null> {
  const data = new FormData();
  songs.forEach((song, index) => {
    const at = `songs[${index}]`;
    data.set(`${at}[key]`, song.key);
    data.set(`${at}[title]`, song.title.trim());
    data.set(`${at}[artist]`, song.artist.trim());
    song.featured.map((name) => name.trim()).filter(Boolean).forEach((name) => data.append(`${at}[featured][]`, name));
    data.set(`${at}[album]`, song.album.trim());
    data.set(`${at}[year]`, song.year);
    if (song.duration) data.set(`${at}[duration]`, String(song.duration));
    if (song.identity) data.set(`${at}[identity]`, song.identity);
  });
  const response = await send("/admin/radio/biblioteca/duplicados", data).catch(() => null);
  if (!response || response.error) return null;
  return (response.results ?? {}) as Record<string, DuplicateMatch[]>;
}

const matchesOf = (review: DuplicateReview) => (Array.isArray(review) ? review : []);

/** The same song is not uploaded twice unless the admin asks for another copy. */
export function isBlocked(review: DuplicateReview, allowed: boolean) {
  return !allowed && matchesOf(review).some((match) => match.verdict === "misma");
}

export function DuplicateBadge({ review }: { review: DuplicateReview }) {
  if (review === null) return null;
  if (review === "error") return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700" title="No pudimos compararla con la biblioteca. Al subirla, el servidor igual revisa que no esté repetida.">No se pudo revisar si está repetida</span>;
  const [first] = review;
  if (!first) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">✓ No está repetida</span>;
  const here = first.batch ? "en esta subida" : "en la biblioteca";
  if (first.verdict === "misma") return <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-800">⚠ {first.batch ? "Repetida en esta subida" : "Ya está en la biblioteca"}</span>;
  if (first.verdict === "posible") return <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Posible duplicado {here}</span>;
  return <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">Otra versión {here}</span>;
}

const VERDICT: Record<DuplicateMatch["verdict"], { tone: string; library: string; batch: string }> = {
  misma: {
    tone: "border-red-200 bg-red-50/70 text-red-950",
    library: "Veredicto: es la misma canción que ya tienes en la biblioteca. No se subirá, para no duplicarla.",
    batch: "Veredicto: es la misma canción que otra de esta subida. Solo se subirá la primera.",
  },
  posible: {
    tone: "border-amber-200 bg-amber-50/70 text-amber-950",
    library: "Veredicto: podría ser la misma canción que una de la biblioteca. Escúchala y decide; se subirá si no la quitas.",
    batch: "Veredicto: podría ser la misma canción que otra de esta subida. Escúchalas y decide; se subirán las dos si no quitas una.",
  },
  version: {
    tone: "border-sky-200 bg-sky-50/70 text-sky-950",
    library: "Veredicto: es otra versión de una canción que ya tienes (no es un duplicado). Se subirá.",
    batch: "Veredicto: es otra versión de una canción de esta subida (no es un duplicado). Se subirán las dos.",
  },
};

/** The verdict on a song that repeats another, the songs it repeats with their reasons, and what the admin can do. */
export function DuplicatePanel({
  review,
  allowed,
  disabled,
  nameOf,
  onAllow,
  onRemove,
}: {
  review: DuplicateReview;
  allowed: boolean;
  disabled: boolean;
  /** How an earlier song of the same upload is called, by its key. */
  nameOf: (key: string) => string;
  onAllow: (allowed: boolean) => void;
  onRemove: () => void;
}) {
  const matches = matchesOf(review);
  const [first] = matches;
  if (!first) return null;
  const verdict = VERDICT[first.verdict];

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-[12.5px] leading-5 ${verdict.tone}`} role="status">
      <p className="font-semibold">{allowed && first.verdict === "misma" ? "Se subirá como otra copia, como pediste." : first.batch ? verdict.batch : verdict.library}</p>
      <ul className="mt-1.5 space-y-1.5">
        {matches.map((match, index) => (
          <li key={match.track?.id ?? match.batch ?? index}>
            <span className="font-medium">
              {match.verdict === "misma" ? "Misma canción" : match.verdict === "posible" ? "Posible duplicado" : "Otra versión"}:{" "}
              {match.track
                ? `«${match.track.title}»${match.track.artist ? ` de ${match.track.artist}` : ""}${[match.track.album, match.track.year, match.track.duration ? duration(match.track.duration) : null].filter(Boolean).map((part) => ` · ${part}`).join("")}`
                : `${nameOf(match.batch ?? "")}, en esta subida`}
            </span>
            <span className="block text-[11.5px] opacity-80">{match.reasons.join(" · ")}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <button type="button" disabled={disabled} onClick={onRemove} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-sm transition hover:bg-ink hover:text-white">
          Quitar de la lista
        </button>
        {first.verdict === "misma" ? (
          <label className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
            <input type="checkbox" checked={allowed} disabled={disabled} onChange={(event) => onAllow(event.target.checked)} /> Subir igual (otra copia)
          </label>
        ) : null}
      </div>
    </div>
  );
}

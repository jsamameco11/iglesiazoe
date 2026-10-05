import { send } from "@/lib/actions";
import { duration } from "@/lib/radio";

/** A song of the library or of the same upload that the song repeats, with the verdict and what it rests on. */
export type DuplicateMatch = {
  verdict: "misma" | "version" | "posible";
  reasons: string[];
  track?: { id: string; title: string; artist: string | null; album: string | null; year: number | null; duration: number | null; cover: string | null; src: string | null };
  /** Key of an earlier song of the same upload. */
  batch?: string;
};

/** Not reviewed yet (null), reviewed (the matches, maybe none) or the review could not be done. */
export type DuplicateReview = DuplicateMatch[] | null | "error";

/** What the admin decided for a song that repeats another: leave it out, put its audio in place of the library one, or keep both. */
export type DuplicateChoice = "skip" | "replace" | "both";

/** A choice holds for the songs it was made about: if the repeated songs change, the admin decides again. */
export type DuplicateDecision = { choice: DuplicateChoice; about: string };

export type SongToReview = { key: string; title: string; artist: string; featured: string[]; album: string; year: string; duration: number | null; identity: string | null };

/**
 * Asks which of the `judge` songs repeat a song of the library or an earlier song of the same upload (every song when
 * `judge` is left out); the others only count as earlier songs. Null when it could not ask. The list travels as JSON
 * because a big upload as form fields goes past what PHP reads.
 */
export async function reviewDuplicates(songs: SongToReview[], judge?: string[]): Promise<Record<string, DuplicateMatch[]> | null> {
  const list = songs.map((song) => ({
    key: song.key,
    title: song.title.trim(),
    artist: song.artist.trim(),
    featured: song.featured.map((name) => name.trim()).filter(Boolean),
    album: song.album.trim(),
    year: song.year,
    duration: song.duration || null,
    identity: song.identity,
  }));
  const payload: Record<string, string> = { songs: JSON.stringify(list) };
  if (judge) payload.judge = JSON.stringify(judge);
  const response = await send("/admin/radio/biblioteca/duplicados", payload).catch(() => null);
  if (!response || response.error) return null;
  return (response.results ?? {}) as Record<string, DuplicateMatch[]>;
}

const matchesOf = (review: DuplicateReview) => (Array.isArray(review) ? review : []);

/** Matches that may be the same song (not just another version of it): the admin has to decide on them. */
export const concerns = (review: DuplicateReview) => matchesOf(review).filter((match) => match.verdict !== "version");

/** The songs a decision is about: `t:` a library song by its id, `b:` a song of the upload by its key. */
export const concernKey = (review: DuplicateReview) =>
  concerns(review)
    .map((match) => (match.track ? `t:${match.track.id}` : `b:${match.batch}`))
    .join("|");

/** Whether the song may be a duplicate, so it is not saved until the admin says what to do with it. */
export function needsDecision(review: DuplicateReview) {
  return concerns(review).length > 0;
}

/** The library song whose audio this one would replace: the closest one that may be the same song. */
export function replaceTarget(review: DuplicateReview) {
  return concerns(review).find((match) => match.track)?.track ?? null;
}

/** The admin's choice for the song as it is reviewed now, or null when there is nothing to decide or it was not decided yet. */
export function choiceOf(review: DuplicateReview, decision: DuplicateDecision | null): DuplicateChoice | null {
  if (!decision || !needsDecision(review) || decision.about !== concernKey(review)) return null;
  if (decision.choice === "replace" && !replaceTarget(review)) return null;
  return decision.choice;
}

/** A possible duplicate still waiting for the admin's choice. */
export function isPending(review: DuplicateReview, decision: DuplicateDecision | null) {
  return needsDecision(review) && choiceOf(review, decision) === null;
}

export function decide(review: DuplicateReview, choice: DuplicateChoice): DuplicateDecision {
  return { choice, about: concernKey(review) };
}

/** What the player calls a match when it is being listened to: the library song, or the song of the upload by its key. */
export const listenKey = (match: DuplicateMatch) => (match.track ? `track:${match.track.id}` : (match.batch ?? ""));

/** How a card is shaded: songs that may repeat another stand out until the admin decides, and then show the decision. */
export function duplicateShade(review: DuplicateReview, decision: DuplicateDecision | null): string | null {
  const [first] = matchesOf(review);
  if (!first) return null;
  if (!needsDecision(review)) return "border-sky-200 bg-sky-50/30";
  const choice = choiceOf(review, decision);
  if (choice === "skip") return "border-slate-200 bg-slate-50 opacity-75";
  if (choice === "replace") return "border-sky-300 bg-sky-50/50";
  if (choice === "both") return "border-emerald-300 bg-emerald-50/40";
  return concerns(review).some((match) => match.verdict === "misma") ? "border-red-300 bg-red-50/60 ring-2 ring-red-200/70" : "border-amber-300 bg-amber-50/60 ring-2 ring-amber-200/70";
}

const CHOSEN: Record<DuplicateChoice, { text: string; tone: string }> = {
  skip: { text: "No se subirá", tone: "bg-slate-200 text-slate-800" },
  replace: { text: "Reemplazará la de la biblioteca", tone: "bg-sky-100 text-sky-900" },
  both: { text: "Se guardarán ambas", tone: "bg-emerald-100 text-emerald-900" },
};

export function DuplicateBadge({ review, decision }: { review: DuplicateReview; decision: DuplicateDecision | null }) {
  if (review === null) return null;
  if (review === "error") return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700" title="No pudimos compararla con la biblioteca. Al subirla, el servidor igual revisa que no esté repetida.">No se pudo revisar si está repetida</span>;
  const [first] = review;
  if (!first) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">✓ No está repetida</span>;
  const choice = choiceOf(review, decision);
  if (choice) return <span className={`rounded-full px-2 py-0.5 font-semibold ${CHOSEN[choice].tone}`}>{CHOSEN[choice].text}</span>;
  const here = first.batch ? "en esta subida" : "en la biblioteca";
  if (first.verdict === "misma") return <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">⚠ {first.batch ? "Repetida en esta subida" : "Ya está en la biblioteca"} · elige qué hacer</span>;
  if (first.verdict === "posible") return <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">⚠ Posible duplicado {here} · elige qué hacer</span>;
  return <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">Otra versión {here}</span>;
}

/** The library song a new one may repeat, shown right above it so both can be compared one after the other. */
export function LibraryTwin({ match, playing, onListen }: { match: DuplicateMatch; playing: string | null; onListen: (match: DuplicateMatch) => void }) {
  const track = match.track;
  if (!track) return null;
  const key = listenKey(match);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-2.5 md:px-4">
      {track.cover ? <img src={track.cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-slate-400">♪</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">Ya está en la biblioteca</span>
        <span className="block truncate text-[13.5px] font-semibold text-ink">
          {track.title}
          {track.artist ? <span className="font-normal text-muted"> · {track.artist}</span> : null}
        </span>
        <span className="block truncate text-[11.5px] text-muted">{[track.album, track.year, track.duration ? duration(track.duration) : null].filter(Boolean).join(" · ") || "Sin álbum ni año"}</span>
      </span>
      {track.src ? (
        <button
          type="button"
          onClick={() => onListen(match)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold shadow-sm transition ${playing === key ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink hover:text-white"}`}
        >
          {playing === key ? "■ Detener" : "▶ Escuchar"}
        </button>
      ) : null}
    </div>
  );
}

const VERDICT: Record<DuplicateMatch["verdict"], { tone: string; library: string; batch: string }> = {
  misma: {
    tone: "border-red-200 bg-white/80 text-red-950",
    library: "Veredicto: es la misma canción que ya tienes en la biblioteca.",
    batch: "Veredicto: es la misma canción que otra de esta subida.",
  },
  posible: {
    tone: "border-amber-200 bg-white/80 text-amber-950",
    library: "Veredicto: podría ser la misma canción que una de la biblioteca. Escúchalas para comparar.",
    batch: "Veredicto: podría ser la misma canción que otra de esta subida. Escúchalas para comparar.",
  },
  version: {
    tone: "border-sky-200 bg-white/80 text-sky-950",
    library: "Veredicto: es otra versión de una canción que ya tienes, no un duplicado. Se subirá.",
    batch: "Veredicto: es otra versión de una canción de esta subida, no un duplicado. Se subirán las dos.",
  },
};

/** The verdict on a song that repeats another, the songs it repeats with their reasons, and the admin's choice. */
export function DuplicatePanel({
  review,
  decision,
  disabled,
  nameOf,
  playing,
  onListen,
  onChoose,
}: {
  review: DuplicateReview;
  decision: DuplicateDecision | null;
  disabled: boolean;
  /** How an earlier song of the same upload is called, by its key. */
  nameOf: (key: string) => string;
  /** What the player is playing now, to show which song is being heard. */
  playing: string | null;
  onListen: (match: DuplicateMatch) => void;
  onChoose: (decision: DuplicateDecision) => void;
}) {
  const matches = matchesOf(review);
  const [first] = matches;
  if (!first) return null;
  const verdict = VERDICT[first.verdict];
  const choice = choiceOf(review, decision);
  const target = replaceTarget(review);
  const inBatch = concerns(review).every((match) => match.batch);
  const options: { choice: DuplicateChoice; title: string; hint: string }[] = [
    { choice: "skip", title: "No subirla", hint: inBatch ? "Se guarda solo la otra de esta subida." : "Te quedas con la que ya está en la biblioteca." },
    ...(target ? [{ choice: "replace" as const, title: "Reemplazar la de la biblioteca", hint: `Este audio toma el lugar de «${target.title}»: conserva su nombre, carátula, estilos, rotación y programación.` }] : []),
    { choice: "both", title: "Guardar ambas", hint: "Quedan las dos en la biblioteca, como canciones aparte." },
  ];

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-[12.5px] leading-5 ${verdict.tone}`} role="status">
      <p className="font-semibold">{first.batch ? verdict.batch : verdict.library}</p>
      <ul className="mt-1.5 space-y-2">
        {matches.map((match, index) => {
          const key = listenKey(match);
          const canListen = match.track ? Boolean(match.track.src) : Boolean(match.batch);
          return (
            <li key={key || index} className="flex items-start gap-2.5">
              {match.track?.cover ? <img src={match.track.cover} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-md object-cover" /> : null}
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {match.verdict === "misma" ? "Misma canción" : match.verdict === "posible" ? "Posible duplicado" : "Otra versión"}:{" "}
                  {match.track
                    ? `«${match.track.title}»${match.track.artist ? ` de ${match.track.artist}` : ""}${[match.track.album, match.track.year, match.track.duration ? duration(match.track.duration) : null].filter(Boolean).map((part) => ` · ${part}`).join("")}`
                    : `${nameOf(match.batch ?? "")}, en esta subida`}
                </span>
                <span className="block text-[11.5px] opacity-80">{match.reasons.join(" · ")}</span>
              </span>
              {canListen ? (
                <button
                  type="button"
                  onClick={() => onListen(match)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm transition ${playing === key ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink hover:text-white"}`}
                  title={match.track ? "Escucha la que ya está en la biblioteca para compararla con la nueva." : "Escucha la otra canción de esta subida para compararlas."}
                >
                  {playing === key ? "■ Detener" : match.track ? "▶ Escuchar la de la biblioteca" : "▶ Escuchar la otra"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {needsDecision(review) ? (
        <div className="mt-3">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] opacity-80">{choice ? "Tu decisión" : "¿Qué hacemos con esta canción? Apenas elijas, la subida sigue con ella"}</p>
          <div className={`mt-1.5 grid gap-2 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} role="radiogroup" aria-label="Qué hacer con esta canción repetida">
            {options.map((option) => {
              const active = choice === option.choice;
              return (
                <button
                  key={option.choice}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onChoose(decide(review, option.choice))}
                  className={`rounded-xl border px-3 py-2 text-left transition disabled:opacity-60 ${active ? "border-ink bg-ink text-white shadow-sm" : "border-line bg-white text-ink hover:border-ink/40"}`}
                >
                  <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                    <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${active ? "border-white" : "border-ink/40"}`}>{active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}</span>
                    {option.title}
                  </span>
                  <span className={`mt-0.5 block text-[11px] leading-4 ${active ? "text-white/80" : "text-muted"}`}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

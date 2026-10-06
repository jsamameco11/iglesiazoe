import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { duration } from "@/lib/radio";
import { compareAudio, printOf, type AcousticMatch, type AudioPrint } from "@/lib/radio/fingerprint";
import { choiceOf, decide, decisionOptions, replaceTarget, type DuplicateChoice, type DuplicateDecision, type DuplicateMatch, type DuplicateReview } from "./duplicates";
import { plain } from "./song-fields";

/** One of the two songs being compared. */
export type CompareSide = {
  key: string;
  /** Where the song is: new, in the library or elsewhere in this upload. */
  place: string;
  title: string;
  /** The author followed by the co-authors. */
  credit: string;
  album: string;
  year: string;
  duration: number | null;
  genres: string[];
  cover: string | null;
  /** The file being uploaded or the address of the library audio. */
  audio: Blob | string | null;
  /** Size of the file when it is known without downloading it. */
  bytes: number | null;
  fileName: string | null;
};

/** A song the new one may repeat, with what the server based its verdict on. */
export type ComparePair = { match: DuplicateMatch; other: CompareSide };

type Side = "a" | "b";
type PrintState = { status: "none" } | { status: "loading" } | { status: "ready"; print: AudioPrint } | { status: "error"; error: string };
type Agreement = "same" | "close" | "diff" | "one" | "none";

const words = (text: string) => plain(text).replace(/[^a-z0-9]+/g, " ").trim();

function agreeText(first: string, second: string): Agreement {
  const [a, b] = [words(first), words(second)];
  if (!a && !b) return "none";
  if (!a || !b) return "one";
  if (a === b) return "same";
  return a.includes(b) || b.includes(a) ? "close" : "diff";
}

function agreeList(first: string[], second: string[]): Agreement {
  const [a, b] = [new Set(first.map(words).filter(Boolean)), new Set(second.map(words).filter(Boolean))];
  if (!a.size && !b.size) return "none";
  if (!a.size || !b.size) return "one";
  const shared = [...a].filter((name) => b.has(name)).length;
  if (shared === a.size && shared === b.size) return "same";
  return shared ? "close" : "diff";
}

function agreeNumber(first: number | null, second: number | null, same: number, close: number): Agreement {
  if (first === null && second === null) return "none";
  if (first === null || second === null) return "one";
  const gap = Math.abs(first - second);
  return gap <= same ? "same" : gap <= close ? "close" : "diff";
}

const AGREEMENT: Record<Agreement, { mark: string; tone: string; label: string }> = {
  same: { mark: "=", tone: "bg-emerald-100 text-emerald-800", label: "Iguales" },
  close: { mark: "≈", tone: "bg-amber-100 text-amber-900", label: "Parecidos" },
  diff: { mark: "≠", tone: "bg-red-100 text-red-800", label: "Distintos" },
  one: { mark: "½", tone: "bg-slate-100 text-slate-700", label: "Solo una lo tiene" },
  none: { mark: "—", tone: "bg-slate-50 text-slate-400", label: "Ninguna lo tiene" },
};

const VERDICT: Record<AcousticMatch["verdict"], { title: string; tone: string; bar: string }> = {
  misma: { title: "Suenan idénticas: es la misma grabación", tone: "border-red-200 bg-red-50 text-red-950", bar: "bg-red-500" },
  parecida: { title: "Suenan muy parecido, pero no idénticas", tone: "border-amber-200 bg-amber-50 text-amber-950", bar: "bg-amber-500" },
  distinta: { title: "Suenan distinto: son grabaciones diferentes", tone: "border-emerald-200 bg-emerald-50 text-emerald-950", bar: "bg-emerald-500" },
};

const seconds = (value: number) => `${Math.abs(value).toFixed(1).replace(".", ",")} s`;
const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const clock = (value: number) => duration(Math.max(0, Math.floor(value)));
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The print of an audio while it is read; the reading is shared and kept, so reopening the comparison is instant. */
function usePrint(audio: Blob | string | null): PrintState {
  const [state, setState] = useState<{ of: Blob | string | null; value: PrintState }>({ of: null, value: { status: "none" } });
  useEffect(() => {
    if (!audio) return;
    let live = true;
    printOf(audio).then(
      (print) => live && setState({ of: audio, value: { status: "ready", print } }),
      (error: unknown) => live && setState({ of: audio, value: { status: "error", error: error instanceof Error ? error.message : String(error) } }),
    );
    return () => {
      live = false;
    };
  }, [audio]);
  if (!audio) return { status: "none" };
  return state.of === audio ? state.value : { status: "loading" };
}

/** An address the player can open: the library one as is, a file through an object URL released when it is no longer shown. */
function usePlayable(audio: Blob | string | null): string | null {
  const [file, setFile] = useState<{ of: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!(audio instanceof Blob)) return;
    const url = URL.createObjectURL(audio);
    setFile({ of: audio, url });
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  if (typeof audio === "string") return audio;
  return audio && file?.of === audio ? file.url : null;
}

/** What to do given how the two sound, their quality and whether the new one can take the library one's place. */
function adviceFor(
  acoustic: AcousticMatch | null | undefined,
  quality: { mine: number | null; theirs: number | null },
  canReplace: boolean,
  inBatch: boolean,
  lengthGap: number | null,
): { choice: DuplicateChoice | null; title: string; text: string } | null {
  if (acoustic === undefined) return null;
  if (acoustic === null) {
    return { choice: null, title: "Decide escuchándolas", text: "No pudimos comparar su sonido (alguna es muy corta o no se pudo leer). Escúchalas con A/B en el mismo punto antes de decidir." };
  }
  const length = lengthGap !== null && Math.abs(lengthGap) > 5 ? ` Ojo: la nueva dura ${seconds(lengthGap)} ${lengthGap > 0 ? "más" : "menos"}; puede tener otro inicio o final.` : "";
  if (acoustic.verdict === "misma") {
    const { mine, theirs } = quality;
    if (canReplace && mine && theirs && mine >= theirs * 1.2 && mine - theirs >= 32) {
      return { choice: "replace", title: "Recomendado: reemplazar la de la biblioteca", text: `Es la misma grabación y la nueva tiene mejor calidad (${mine} kbps frente a ${theirs} kbps). Al reemplazarla mejora el sonido y conserva su nombre, carátula, rotación y programación.${length}` };
    }
    const worse = mine && theirs && mine < theirs * 0.85 ? " La que ya tienes incluso tiene mejor calidad." : "";
    return { choice: "skip", title: "Recomendado: no subirla", text: `${inBatch ? "Es la misma grabación que otra de esta subida: con una basta." : "Es la misma grabación que ya tienes: subirla otra vez solo la duplicaría."}${worse}${length}` };
  }
  if (acoustic.verdict === "parecida") {
    return { choice: null, title: "Escúchalas antes de decidir", text: "Se parecen mucho, pero no son idénticas: puede ser una remasterización, otra mezcla o un archivo con cortes. Usa A/B (barra espaciadora) para oírlas en el mismo punto." };
  }
  return { choice: "both", title: "Recomendado: guardar ambas", text: "Su sonido es distinto: son grabaciones diferentes de la canción (en vivo, acústica, otra versión o un cover), no un duplicado." };
}

/** The wave of an audio with what was played, the coincidence along it and a click to jump to a moment. */
function Wave({ print, progress, tone, timeline, total, onSeek }: { print: PrintState; progress: number; tone: Side; timeline?: AcousticMatch["timeline"]; total: number; onSeek: (fraction: number) => void }) {
  const played = tone === "a" ? "fill-orange-500" : "fill-sky-600";
  if (print.status !== "ready") {
    return (
      <div className={`grid h-16 place-items-center rounded-xl bg-paper text-[11.5px] font-semibold ${print.status === "error" ? "text-red-700" : "animate-pulse text-muted"}`}>
        {print.status === "error" ? "No se pudo leer este audio" : print.status === "none" ? "Sin audio" : "Leyendo el audio…"}
      </div>
    );
  }
  const peaks = print.print.peaks;
  const width = peaks.length / print.print.covered;
  return (
    <div>
      <svg
        viewBox={`0 0 ${width} 48`}
        preserveAspectRatio="none"
        className="h-16 w-full cursor-pointer rounded-xl bg-paper"
        role="slider"
        aria-label="Posición del audio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onSeek(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
        }}
      >
        {Array.from(peaks, (peak, index) => {
          const height = Math.max(1.5, peak * 44);
          return <rect key={index} x={index + 0.15} y={24 - height / 2} width={0.7} height={height} className={index / width < progress ? played : "fill-ink/20"} />;
        })}
        {width > peaks.length + 1 ? (
          <>
            <rect x={peaks.length} y={23.5} width={width - peaks.length} height={1} className={progress > peaks.length / width ? played : "fill-ink/20"} />
            <title>Para comparar solo descargamos el inicio; igual puedes escucharla completa.</title>
          </>
        ) : null}
      </svg>
      {timeline && total > 0 ? (
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" title="Coincidencia del sonido a lo largo de la nueva: verde igual, ámbar parecido, rojo distinto.">
          {timeline.map((window) => (
            <span
              key={window.at}
              className={`absolute inset-y-0 ${window.score >= 0.7 ? "bg-emerald-500" : window.score >= 0.5 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ left: `${(window.at / total) * 100}%`, width: `${(5 / total) * 100}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SideCard({
  side,
  tone,
  print,
  time,
  total,
  playing,
  playable,
  timeline,
  onToggle,
  onSeek,
}: {
  side: CompareSide;
  tone: Side;
  print: PrintState;
  time: number;
  total: number;
  playing: boolean;
  playable: boolean;
  timeline?: AcousticMatch["timeline"];
  onToggle: () => void;
  onSeek: (fraction: number) => void;
}) {
  const badge = tone === "a" ? "bg-orange-500" : "bg-sky-600";
  return (
    <div className={`min-w-0 rounded-2xl border p-3.5 ${playing ? (tone === "a" ? "border-orange-300 ring-2 ring-orange-200" : "border-sky-300 ring-2 ring-sky-200") : "border-line"}`}>
      <div className="flex items-start gap-3">
        {side.cover ? <img src={side.cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-paper text-xl text-muted">♪</span>}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
            <span className={`grid h-4 w-4 place-items-center rounded text-[10px] text-white ${badge}`}>{tone.toUpperCase()}</span>
            {side.place}
          </span>
          <span className="mt-0.5 block truncate text-[15px] font-semibold tracking-[-0.01em] text-ink" title={side.title}>
            {side.title || "Sin nombre"}
          </span>
          <span className="block truncate text-[12.5px] text-muted">{side.credit || "Sin autor"}</span>
          {side.fileName ? <span className="block truncate text-[11px] text-muted/80" title={side.fileName}>{side.fileName}</span> : null}
        </span>
      </div>
      <div className="mt-3">
        <Wave print={print} progress={total > 0 ? time / total : 0} tone={tone} timeline={timeline} total={total} onSeek={onSeek} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={!playable}
          className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition disabled:opacity-50 ${badge} hover:brightness-110`}
          title={`Tecla ${tone.toUpperCase()}`}
        >
          {playing ? "■ Pausar" : `▶ Escuchar ${tone.toUpperCase()}`}
        </button>
        <span className="ml-auto font-mono text-[11.5px] tabular-nums text-muted">
          {clock(time)} / {total > 0 ? clock(total) : "–:––"}
        </span>
      </div>
    </div>
  );
}

function Row({ label, mine, theirs, agreement, note }: { label: string; mine: ReactNode; theirs: ReactNode; agreement: Agreement; note?: string }) {
  const look = AGREEMENT[agreement];
  return (
    <tr className="border-t border-line/70 align-top">
      <th scope="row" className="py-2 pr-3 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
        {label}
      </th>
      <td className="py-2 pr-3 text-[12.5px] text-ink">{mine || <span className="text-muted">—</span>}</td>
      <td className="py-2 pr-3 text-[12.5px] text-ink">{theirs || <span className="text-muted">—</span>}</td>
      <td className="py-2 text-right">
        <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-bold ${look.tone}`} title={note ?? look.label}>
          {look.mark}
        </span>
      </td>
    </tr>
  );
}

/** The two songs side by side, remounted for each pair so its players and analysis start fresh. */
function Comparison({
  song,
  pair,
  review,
  decision,
  disabled,
  onChoose,
  onSwap,
}: {
  song: CompareSide;
  pair: ComparePair;
  review: DuplicateReview;
  decision: DuplicateDecision | null;
  disabled: boolean;
  onChoose: (decision: DuplicateDecision) => void;
  onSwap?: () => void;
}) {
  const other = pair.other;
  const mine = usePrint(song.audio);
  const theirs = usePrint(other.audio);
  const sources = { a: usePlayable(song.audio), b: usePlayable(other.audio) };
  const players = { a: useRef<HTMLAudioElement>(null), b: useRef<HTMLAudioElement>(null) };
  const [playing, setPlaying] = useState<Side | null>(null);
  const [times, setTimes] = useState({ a: 0, b: 0 });

  const acoustic = useMemo(() => (mine.status === "ready" && theirs.status === "ready" ? compareAudio(mine.print, theirs.print) : mine.status === "error" || theirs.status === "error" || mine.status === "none" || theirs.status === "none" ? null : undefined), [mine, theirs]);
  const lengthOf = (side: Side) => {
    const print = side === "a" ? mine : theirs;
    const data = side === "a" ? song : other;
    return players[side].current?.duration && Number.isFinite(players[side].current?.duration) ? (players[side].current?.duration as number) : print.status === "ready" ? print.print.seconds : (data.duration ?? 0);
  };
  const secondsOf = (print: PrintState, data: CompareSide) => data.duration ?? (print.status === "ready" ? print.print.seconds : null);
  const bytesOf = (print: PrintState, data: CompareSide) => data.bytes ?? (print.status === "ready" ? print.print.bytes : null);
  const quality = { mine: mine.status === "ready" ? mine.print.kbps : null, theirs: theirs.status === "ready" ? theirs.print.kbps : null };
  const lengths = { mine: secondsOf(mine, song), theirs: secondsOf(theirs, other) };
  const lengthGap = lengths.mine !== null && lengths.theirs !== null ? lengths.mine - lengths.theirs : null;
  const loudness = { mine: mine.status === "ready" ? mine.print.loudness : null, theirs: theirs.status === "ready" ? theirs.print.loudness : null };
  const options = decisionOptions(review);
  const canReplace = Boolean(pair.match.track) && replaceTarget(review)?.id === pair.match.track?.id;
  const advice = adviceFor(acoustic, quality, canReplace, !pair.match.track, lengthGap);
  const chosen = choiceOf(review, decision);
  const offset = acoustic?.offset ?? 0;

  function play(side: Side, at?: number) {
    const [me, rest] = side === "a" ? [players.a.current, players.b.current] : [players.b.current, players.a.current];
    if (!me) return;
    rest?.pause();
    if (at !== undefined) me.currentTime = Math.max(0, Math.min(at, (Number.isFinite(me.duration) ? me.duration : at) - 0.25));
    me.play().then(
      () => setPlaying(side),
      () => setPlaying(null),
    );
  }

  function toggle(side: Side) {
    if (playing === side) {
      players[side].current?.pause();
      setPlaying(null);
    } else {
      play(side);
    }
  }

  /** Jumps to the other song at the same moment of the music, so a difference is heard right away. */
  function swap() {
    if (playing === "a") play("b", (players.a.current?.currentTime ?? 0) + offset);
    else if (playing === "b") play("a", (players.b.current?.currentTime ?? 0) - offset);
    else play("a");
  }

  function seek(side: Side, fraction: number) {
    const total = lengthOf(side);
    if (!total) return;
    const player = players[side].current;
    if (playing === side || !player) play(side, fraction * total);
    else {
      player.currentTime = fraction * total;
      setTimes((now) => ({ ...now, [side]: fraction * total }));
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "b") {
        event.preventDefault();
        toggle(key);
      } else if (key === " ") {
        event.preventDefault();
        swap();
      } else if (/^[1-3]$/.test(key) && !disabled) {
        const option = options[Number(key) - 1];
        if (option) onChoose(decide(review, option.choice));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const audioFor = (side: Side) =>
    sources[side] ? (
      <audio
        ref={players[side]}
        src={sources[side] ?? undefined}
        preload="metadata"
        onTimeUpdate={(event) => {
          const at = event.currentTarget.currentTime;
          setTimes((now) => ({ ...now, [side]: at }));
        }}
        onPause={() => setPlaying((now) => (now === side ? null : now))}
        onEnded={() => setPlaying((now) => (now === side ? null : now))}
        hidden
      />
    ) : null;

  const reasons = pair.match.reasons.length ? pair.match.reasons.join(" · ") : null;

  return (
    <div className="space-y-4">
      {audioFor("a")}
      {audioFor("b")}

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <SideCard side={song} tone="a" print={mine} time={times.a} total={lengthOf("a")} playing={playing === "a"} playable={Boolean(sources.a)} timeline={acoustic?.timeline} onToggle={() => toggle("a")} onSeek={(fraction) => seek("a", fraction)} />
        <button
          type="button"
          onClick={swap}
          disabled={!sources.a || !sources.b}
          className="mx-auto flex flex-col items-center gap-0.5 rounded-2xl border border-line bg-white px-3 py-2 text-[11px] font-semibold text-ink shadow-sm transition hover:border-ink/40 disabled:opacity-50"
          title="Salta a la otra canción en el mismo momento de la música (barra espaciadora)."
        >
          <span className="text-lg leading-none">⇄</span>
          A/B
          <span className="font-normal text-muted">espacio</span>
        </button>
        <SideCard side={other} tone="b" print={theirs} time={times.b} total={lengthOf("b")} playing={playing === "b"} playable={Boolean(sources.b)} onToggle={() => toggle("b")} onSeek={(fraction) => seek("b", fraction)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Sus datos, campo por campo</p>
          <table className="mt-1 w-full table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[33%]" />
              <col className="w-[33%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                <th />
                <th className="pb-1">
                  <span className="mr-1 rounded bg-orange-500 px-1 text-white">A</span>
                  {song.place}
                </th>
                <th className="pb-1">
                  <span className="mr-1 rounded bg-sky-600 px-1 text-white">B</span>
                  {other.place}
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="break-words">
              <Row label="Nombre" mine={song.title} theirs={other.title} agreement={agreeText(song.title, other.title)} />
              <Row label="Autor y coautores" mine={song.credit} theirs={other.credit} agreement={agreeList(song.credit.split(","), other.credit.split(","))} />
              <Row label="Álbum" mine={song.album} theirs={other.album} agreement={agreeText(song.album, other.album)} />
              <Row label="Año" mine={song.year} theirs={other.year} agreement={agreeNumber(song.year ? Number(song.year) : null, other.year ? Number(other.year) : null, 0, 1)} />
              <Row
                label="Duración"
                mine={lengths.mine ? clock(lengths.mine) : null}
                theirs={lengths.theirs ? clock(lengths.theirs) : null}
                agreement={agreeNumber(lengths.mine, lengths.theirs, 2, 6)}
                note={lengthGap !== null ? `Diferencia: ${seconds(lengthGap)}` : undefined}
              />
              <Row label="Estilos" mine={song.genres.join(", ")} theirs={other.genres.join(", ")} agreement={agreeList(song.genres, other.genres)} />
              <Row
                label="Calidad"
                mine={quality.mine ? `${quality.mine} kbps` : null}
                theirs={quality.theirs ? `${quality.theirs} kbps` : null}
                agreement={agreeNumber(quality.mine, quality.theirs, 16, 64)}
                note="Kilobits por segundo del archivo: a más, mejor sonido."
              />
              <Row
                label="Tamaño"
                mine={bytesOf(mine, song) ? sizeLabel(bytesOf(mine, song) as number) : null}
                theirs={bytesOf(theirs, other) ? sizeLabel(bytesOf(theirs, other) as number) : null}
                agreement={agreeNumber(bytesOf(mine, song), bytesOf(theirs, other), 64 * 1024, 1024 * 1024)}
              />
              <Row
                label="Volumen medio"
                mine={loudness.mine !== null ? `${loudness.mine.toFixed(1).replace(".", ",")} dB` : null}
                theirs={loudness.theirs !== null ? `${loudness.theirs.toFixed(1).replace(".", ",")} dB` : null}
                agreement={agreeNumber(loudness.mine, loudness.theirs, 1.5, 4)}
                note="Nivel promedio de la señal; una diferencia grande suele ser otra masterización."
              />
            </tbody>
          </table>
          {reasons ? <p className="mt-2 border-t border-line/70 pt-2 text-[11.5px] leading-4 text-muted">Por qué la marcamos como repetida: {reasons}.</p> : null}
          {onSwap && pair.match.reasons.includes("nombre y autor al revés") ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
              <span className="min-w-0 flex-1">El nombre y el autor de la nueva están al revés: «{song.title}» es el autor y «{song.credit}» la canción.</span>
              <button type="button" onClick={onSwap} disabled={disabled} className="shrink-0 rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-ink shadow-sm transition hover:bg-ink hover:text-white disabled:opacity-50">
                ⇄ Intercambiarlos
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className={`rounded-2xl border px-4 py-3 ${acoustic ? VERDICT[acoustic.verdict].tone : "border-line bg-white text-ink"}`}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] opacity-70">Comparación del sonido</p>
            {acoustic === undefined ? (
              <div className="mt-2 space-y-2">
                <p className="animate-pulse text-[13px] font-semibold">Analizando el sonido de las dos…</p>
                <p className="text-[11.5px] text-muted">
                  {mine.status === "ready" ? "✓ A leída" : "Leyendo A…"} · {theirs.status === "ready" ? "✓ B leída" : other.audio instanceof Blob ? "Leyendo B…" : "Descargando B de la biblioteca…"}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-ink/30" />
                </div>
              </div>
            ) : acoustic === null ? (
              <p className="mt-2 text-[13px]">{mine.status === "error" || theirs.status === "error" ? "No se pudo leer alguno de los audios para compararlos." : "Alguna es demasiado corta o no tiene audio para comparar su sonido."}</p>
            ) : (
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">{Math.round(acoustic.score * 100)}%</span>
                  <span className="text-[13px] font-semibold">{VERDICT[acoustic.verdict].title}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                  <div className={`h-full rounded-full ${VERDICT[acoustic.verdict].bar}`} style={{ width: `${Math.max(3, Math.round(acoustic.score * 100))}%` }} />
                </div>
                <ul className="mt-2 space-y-0.5 text-[11.5px] leading-4 opacity-85">
                  <li>
                    Comparamos {clock(acoustic.overlap)} de audio alineado.
                    {Math.abs(acoustic.offset) < 0.3 ? " Empiezan en el mismo punto." : ` ${acoustic.offset > 0 ? "B" : "A"} tiene ${seconds(acoustic.offset)} más de inicio; el A/B ya lo compensa.`}
                  </li>
                  <li>La franja bajo la onda de A muestra dónde coinciden: verde igual, ámbar parecido, rojo distinto.</li>
                  {pair.match.verdict !== "misma" && acoustic.verdict === "misma" ? <li className="font-semibold">Aunque sus datos no coinciden del todo, el sonido es el mismo: es la misma grabación con otros datos.</li> : null}
                  {pair.match.verdict === "misma" && acoustic.verdict === "distinta" ? <li className="font-semibold">Sus datos dicen que es la misma canción, pero el sonido no: seguramente es otra versión (en vivo, acústica, otra mezcla) o un archivo mal etiquetado.</li> : null}
                </ul>
              </div>
            )}
          </div>

          {advice ? (
            <div className="rounded-2xl border border-ink/15 bg-ink/[0.03] px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">{advice.title}</p>
              <p className="mt-0.5 text-[12px] leading-5 text-muted">{advice.text}</p>
            </div>
          ) : null}

          <div className="grid gap-2" role="radiogroup" aria-label="Qué hacer con esta canción repetida">
            {options.map((option, index) => {
              const active = chosen === option.choice;
              const suggested = advice?.choice === option.choice;
              return (
                <button
                  key={option.choice}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onChoose(decide(review, option.choice))}
                  className={`rounded-xl border px-3 py-2 text-left transition disabled:opacity-60 ${active ? "border-ink bg-ink text-white shadow-sm" : suggested ? "border-emerald-400 bg-emerald-50/60 text-ink ring-1 ring-emerald-300 hover:border-emerald-500" : "border-line bg-white text-ink hover:border-ink/40"}`}
                >
                  <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                    <kbd className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[10.5px] ${active ? "border-white/60" : "border-ink/25"}`}>{index + 1}</kbd>
                    {option.title}
                    {suggested && !active ? <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-white">Recomendado</span> : null}
                    {active ? <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.05em] text-white/80">Tu decisión</span> : null}
                  </span>
                  <span className={`mt-0.5 block text-[11px] leading-4 ${active ? "text-white/80" : "text-muted"}`}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Both songs side by side to settle whether a new song is one already in the library (or elsewhere in the upload):
 * their data field by field, their waves, A/B listening at the same moment of the music and an acoustic comparison
 * that tells the very same recording from another version, with a recommendation and the three choices.
 */
export function CompareDialog({
  song,
  pairs,
  review,
  decision,
  disabled,
  position,
  onStep,
  onChoose,
  onSwap,
  onClose,
}: {
  song: CompareSide;
  pairs: ComparePair[];
  review: DuplicateReview;
  decision: DuplicateDecision | null;
  disabled: boolean;
  /** Where this song is among the repeated ones of the upload, and how many still wait for a choice. */
  position: { index: number; total: number; pending: number };
  onStep: (direction: -1 | 1) => void;
  onChoose: (decision: DuplicateDecision) => void;
  /** Swaps the name and the author of the new song, when they came the other way round. */
  onSwap?: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const pair = pairs[Math.min(selected, pairs.length - 1)];

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && position.total > 1) onStep(-1);
      else if (event.key === "ArrowRight" && position.total > 1) onStep(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, position.total]);

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/55 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Comparar canciones repetidas" onClick={onClose}>
      <div className="w-full max-w-6xl rounded-t-3xl bg-card p-4 shadow-2xl sm:rounded-3xl sm:p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Repetida {position.index + 1} de {position.total}
              {position.pending ? ` · ${position.pending === 1 ? "falta decidir 1" : `faltan decidir ${position.pending}`}` : " · ya decidiste todas ✓"}
            </p>
            <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-ink">¿Es la misma canción? Compáralas juntas</h2>
          </div>
          {position.total > 1 ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onStep(-1)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-ink/40" title="Anterior (←)">
                ← Anterior
              </button>
              <button type="button" onClick={() => onStep(1)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-ink/40" title="Siguiente (→)">
                Siguiente →
              </button>
            </div>
          ) : null}
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-paper text-lg text-ink transition hover:bg-ink hover:text-white" aria-label="Cerrar (Esc)" title="Cerrar (Esc)">
            ×
          </button>
        </div>

        {pairs.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Canciones con las que podría estar repetida">
            {pairs.map((entry, index) => (
              <button
                key={entry.other.key}
                type="button"
                role="tab"
                aria-selected={entry === pair}
                onClick={() => setSelected(index)}
                className={`max-w-xs truncate rounded-full px-3 py-1 text-[12px] font-semibold transition ${entry === pair ? "bg-ink text-white" : "bg-paper text-ink hover:bg-ink/10"}`}
              >
                {entry.match.verdict === "misma" ? "Misma" : "Posible"} · «{entry.other.title}» · {entry.other.place.toLowerCase()}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {pair ? (
            <Comparison key={`${song.key}|${pair.other.key}`} song={song} pair={pair} review={review} decision={decision} disabled={disabled} onChoose={onChoose} onSwap={onSwap} />
          ) : (
            <p className="rounded-2xl bg-paper px-4 py-6 text-center text-[13px] text-muted">Esta canción ya no tiene con qué compararse.</p>
          )}
        </div>

        <p className="mt-4 border-t border-line pt-3 text-[11px] text-muted">
          Atajos: <kbd className="font-semibold">A</kbd> / <kbd className="font-semibold">B</kbd> escuchar · <kbd className="font-semibold">Espacio</kbd> saltar a la otra en el mismo punto · <kbd className="font-semibold">1</kbd> <kbd className="font-semibold">2</kbd> <kbd className="font-semibold">3</kbd> decidir
          {position.total > 1 ? (
            <>
              {" "}
              · <kbd className="font-semibold">←</kbd> <kbd className="font-semibold">→</kbd> anterior o siguiente
            </>
          ) : null}{" "}
          · <kbd className="font-semibold">Esc</kbd> cerrar
        </p>
      </div>
    </div>,
    document.body,
  );
}

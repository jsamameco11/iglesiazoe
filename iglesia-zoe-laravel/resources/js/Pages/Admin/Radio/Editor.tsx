import { Link, router } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KindTag, RadioHeader } from "@/Components/radio/admin-ui";
import { SearchIcon } from "@/Components/radio/icons";
import { PreviewEngine } from "@/Components/radio/editor/engine";
import { Slider, SoundPanel } from "@/Components/radio/editor/sound-panel";
import { Waveform } from "@/Components/radio/editor/waveform";
import {
  EQ_BANDS,
  PRESETS,
  cutAt,
  editedLength,
  fromSaved,
  isPlain,
  joins,
  keeps,
  mergeCuts,
  preciseTime,
  restoreRange,
  sameRecipe,
  serverOnly,
  toEdited,
  toSource,
  type Cut,
  type Recipe,
} from "@/Components/radio/editor/recipe";
import { Notice, Panel, button, ghost, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { csrf, send, type ActionResult } from "@/lib/actions";
import { duration as clockDuration, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";
import "../../../../css/radio-editor.css";

const EDITOR = "/admin/radio/editor";

type Kind = RadioTrack["kind"];

type Track = { id: string; title: string; credit: string | null; kind: Kind; cover: string | null; duration: number; edited: boolean; editing: boolean };

type Current = {
  id: string;
  title: string;
  credit: string | null;
  kind: Kind;
  cover: string | null;
  duration: number;
  source: { src: string; duration: number };
  edit: Partial<Recipe> | null;
  edited: boolean;
  editedAt: string | null;
  status: "processing" | "failed" | null;
  error: string | null;
  upcoming: number;
  episodes: number;
};

type Limits = { maxCuts: number; maxFade: number; maxJoin: number; maxGain: number; minLength: number; previewSeconds: number; targetLufs: number };

type Props = { tracks: Track[]; kinds: Record<Kind, string>; current: Current | null; limits: Limits };

type Analysis = { perSecond: number; peaks: Int8Array; loudness: number | null; peak: number | null };

export default function Editor({ tracks, kinds, current, limits }: Props) {
  return (
    <AdminLayout>
      <RadioHeader
        title="Editor de audio"
        text="Recorta canciones, anuncios, programas y episodios, y mejora su sonido. Escuchas cada cambio al instante; al guardar, el audio queda editado en la biblioteca y en todo lo programado. El original se guarda aparte: siempre puedes volver a él."
        aside={current ? <Link href={EDITOR} className={ghost}>← Elegir otro audio</Link> : undefined}
      />
      {current ? <Workspace key={`${current.id}-${current.editedAt ?? "original"}`} current={current} limits={limits} kinds={kinds} /> : <Chooser tracks={tracks} kinds={kinds} />}
    </AdminLayout>
  );
}

/* ───────────────────────────── Choosing the audio ───────────────────────────── */

function Chooser({ tracks, kinds }: { tracks: Track[]; kinds: Record<Kind, string> }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Kind | "">("");
  const needle = query.trim().toLowerCase();
  const kindList = (Object.keys(kinds) as Kind[]).filter((kind) => tracks.some((track) => track.kind === kind));
  const shown = tracks.filter((track) => (!tab || track.kind === tab) && `${track.title} ${track.credit ?? ""}`.toLowerCase().includes(needle));

  return (
    <section className="mt-6 rounded-[1.6rem] border border-line bg-card p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-[-0.025em]">¿Qué audio quieres editar?</h2>
        <p className="text-[13px] text-muted">Elige una canción, un anuncio, un efecto o un programa de la biblioteca. Los audios de los episodios también están aquí.</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["", ...kindList] as const).map((kind) => (
            <button
              key={kind || "all"}
              type="button"
              onClick={() => setTab(kind)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${tab === kind ? "bg-ink text-white" : "bg-paper text-muted hover:text-ink"}`}
            >
              {kind ? kinds[kind] : "Todos"} · {kind ? tracks.filter((track) => track.kind === kind).length : tracks.length}
            </button>
          ))}
        </div>
        <label className="relative block lg:w-80">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o artista" className={`${input} mt-0 pl-10`} />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-paper px-5 py-10 text-center text-sm text-muted">{tracks.length ? "Ningún audio coincide con la búsqueda." : "La biblioteca todavía no tiene audios. Súbelos en «Biblioteca»."}</p>
      ) : (
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {shown.map((track) => (
            <li key={track.id}>
              <Link href={`${EDITOR}?audio=${track.id}`} className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-3 transition hover:border-ink/25 hover:shadow-sm">
                <Cover src={track.cover} className="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{track.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <KindTag kind={track.kind} label={kinds[track.kind]} />
                    {track.credit && <span className="truncate">{track.credit}</span>}
                    <span className="tabular-nums">· {clockDuration(track.duration)}</span>
                  </span>
                </span>
                {track.editing ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Procesando…</span>
                ) : track.edited ? (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">Editado</span>
                ) : null}
                <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold transition group-hover:bg-ink group-hover:text-white">Editar</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Cover({ src, className = "" }: { src: string | null; className?: string }) {
  return src ? (
    <img src={src} alt="" className={`shrink-0 rounded-xl object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-paper text-muted ${className}`}>
      <Icon name="wave" className="h-5 w-5" />
    </span>
  );
}

/* ───────────────────────────── Undo / redo ───────────────────────────── */

type History = { past: Recipe[]; present: Recipe; future: Recipe[]; group: string | null; at: number };

function useRecipeHistory(initial: Recipe) {
  const [state, setState] = useState<History>({ past: [], present: initial, future: [], group: null, at: 0 });

  /** Changes made with the same control within a moment (dragging a slider) undo as one step. */
  const change = useCallback((next: Recipe | ((recipe: Recipe) => Recipe), group?: string) => {
    setState((history) => {
      const value = typeof next === "function" ? next(history.present) : next;
      if (sameRecipe(value, history.present) && value.preset === history.present.preset) return history;
      const now = Date.now();
      const merge = group !== undefined && history.group === group && now - history.at < 1200;
      return { past: merge ? history.past : [...history.past.slice(-149), history.present], present: value, future: [], group: group ?? null, at: now };
    });
  }, []);

  const undo = useCallback(() => {
    setState((history) =>
      history.past.length ? { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future], group: null, at: 0 } : history,
    );
  }, []);

  const redo = useCallback(() => {
    setState((history) => (history.future.length ? { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1), group: null, at: 0 } : history));
  }, []);

  return { recipe: state.present, change, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

/* ───────────────────────────── The workspace ───────────────────────────── */

function Workspace({ current, limits, kinds }: { current: Current; limits: Limits; kinds: Record<Kind, string> }) {
  const total = current.source.duration;
  const baseline = useMemo(() => fromSaved(current.edit, total), [current.edit, total]);
  const { recipe, change, undo, redo, canUndo, canRedo } = useRecipeHistory(baseline);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Cut | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bypass, setBypass] = useState(false);
  const [loop, setLoop] = useState(false);
  const [time, setTime] = useState(0);
  const [, setRevision] = useState(0);
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [status, setStatus] = useState(current.status);
  const [statusError, setStatusError] = useState(current.error);
  const [confirming, setConfirming] = useState<"save" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<{ url: string; at: number } | null>(null);
  const [sampling, setSampling] = useState(false);
  const engine = useRef<PreviewEngine | null>(null);
  const leaving = useRef(false);
  const meterLeft = useRef<HTMLSpanElement>(null);
  const meterRight = useRef<HTMLSpanElement>(null);
  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;

  const length = editedLength(recipe, total);
  const dirty = !sameRecipe(recipe, baseline);
  const processing = status === "processing";
  const playing = engine.current?.playing ?? false;
  const parts = keeps(recipe.cuts, total);
  const overlaps = joins(recipe, total);
  const selectionCuts = selection ? recipe.cuts.some(([from, to]) => from < selection[1] && to > selection[0]) : false;
  const fades = useMemo(() => {
    const kept = keeps(recipe.cuts, total);
    const length = editedLength(recipe, total);
    return {
      in: recipe.fadeIn > 0 && kept.length ? ([kept[0][0], toSource(recipe.fadeIn, recipe, total)] as Cut) : null,
      out: recipe.fadeOut > 0 && kept.length ? ([toSource(length - recipe.fadeOut, recipe, total), kept[kept.length - 1][1]] as Cut) : null,
    };
  }, [recipe, total]);

  useEffect(() => {
    const preview = new PreviewEngine(current.source.src, total, recipeRef.current, () => setRevision((value) => value + 1));
    engine.current = preview;
    return () => {
      preview.destroy();
      engine.current = null;
    };
  }, [current.source.src, total]);

  useEffect(() => engine.current?.setRecipe(recipe), [recipe]);
  useEffect(() => engine.current?.setLoudness(analysis?.loudness ?? null), [analysis]);
  useEffect(() => engine.current?.setBypass(bypass), [bypass]);
  useEffect(() => engine.current?.setLoop(loop ? selection : null), [loop, selection]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const preview = engine.current;
      if (preview) {
        setTime(preview.time);
        const [left, right] = preview.levels();
        const width = (db: number) => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
        if (meterLeft.current) meterLeft.current.style.width = width(left);
        if (meterRight.current) meterRight.current.style.width = width(right);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${EDITOR}/analisis?id=${current.id}`, { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !body.peaks) {
          setAnalysisError(body.error ?? "No pudimos dibujar la onda de este audio.");
          return;
        }
        const bytes = Uint8Array.from(atob(body.peaks), (character) => character.charCodeAt(0));
        setAnalysis({ perSecond: body.perSecond, peaks: new Int8Array(bytes.buffer), loudness: body.loudness ?? null, peak: body.peak ?? null });
      })
      .catch(() => !cancelled && setAnalysisError("Se cortó la conexión mientras leíamos el audio. Recarga la página."));
    return () => {
      cancelled = true;
    };
  }, [current.id]);

  /** While the server renders, follow it; when it ends the page reloads with the edited audio. */
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`${EDITOR}/estado?id=${current.id}`, { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } }).catch(() => null);
      const body = response ? await response.json().catch(() => null) : null;
      if (!body || body.status === "processing") return;
      if (body.status === "failed") {
        setStatus("failed");
        setStatusError(body.error ?? "El procesamiento falló. Inténtalo de nuevo.");
        return;
      }
      leaving.current = true;
      router.reload();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [processing, current.id]);

  useEffect(() => {
    if (!dirty || processing) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", unload);
    const off = router.on("before", (event) => {
      if (leaving.current) return;
      if (!window.confirm("Tienes cambios sin guardar en el editor. ¿Salir sin guardarlos?")) event.preventDefault();
    });
    return () => {
      window.removeEventListener("beforeunload", unload);
      off();
    };
  }, [dirty, processing]);

  useEffect(() => () => {
    if (sample) URL.revokeObjectURL(sample.url);
  }, [sample]);

  const togglePlay = useCallback(() => {
    const preview = engine.current;
    if (!preview) return;
    if (preview.playing) preview.pause();
    else {
      setSample(null);
      void preview.play(selection && loop ? selection[0] : undefined);
    }
  }, [loop, selection]);

  const seek = useCallback((at: number) => {
    engine.current?.seek(at);
    setTime(at);
  }, []);

  /** Applies new cuts when they leave enough audio. */
  const applyCuts = useCallback(
    (cuts: Cut[], after?: () => void) => {
      const next = mergeCuts(cuts, total);
      if (next.length > limits.maxCuts) {
        setNotice({ error: `Puedes tener hasta ${limits.maxCuts} cortes en un audio.` });
        return;
      }
      if (editedLength({ ...recipeRef.current, cuts: next }, total) < limits.minLength) {
        setNotice({ error: "Así no quedaría audio: deja al menos un segundo sin cortar." });
        return;
      }
      setNotice(null);
      change((recipe) => ({ ...recipe, cuts: next }));
      after?.();
    },
    [change, limits.maxCuts, limits.minLength, total],
  );

  const cutSelection = useCallback(() => {
    if (!selection) return;
    applyCuts([...recipeRef.current.cuts, selection], () => {
      setSelection(null);
      seek(Math.min(selection[1], total));
    });
  }, [applyCuts, selection, seek, total]);

  const keepSelection = useCallback(() => {
    if (!selection) return;
    applyCuts([...recipeRef.current.cuts, [0, selection[0]], [selection[1], total]], () => {
      setSelection(null);
      seek(selection[0]);
    });
  }, [applyCuts, selection, seek, total]);

  const restoreSelection = useCallback(() => {
    if (!selection) return;
    change((recipe) => ({ ...recipe, cuts: restoreRange(recipe.cuts, selection, total) }));
    setSelection(null);
  }, [change, selection, total]);

  const mark = useCallback(
    (edge: 0 | 1) => {
      const at = engine.current?.time ?? time;
      setSelection((range) => {
        const next: Cut = range ? [...range] : edge === 0 ? [at, total] : [0, at];
        next[edge] = at;
        return next[1] - next[0] >= 0.05 ? [Math.min(...next), Math.max(...next)] : null;
      });
    },
    [time, total],
  );

  const zoomBy = useCallback((factor: number) => setZoom((value) => Math.max(1, Math.min(Math.max(1, (total * 600) / 900), value * factor))), [total]);

  /** Shortcuts of a professional editor; they do nothing while typing in a text field. */
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "SELECT" || (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range") || target.isContentEditable);
      if (typing || confirming) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (command && key === "y") {
        event.preventDefault();
        redo();
      } else if (command) {
        return;
      } else if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        cutSelection();
      } else if (key === "i") mark(0);
      else if (key === "o") mark(1);
      else if (key === "l") setLoop((value) => !value);
      else if (key === "b") setBypass((value) => !value);
      else if (event.key === "+" || event.key === "=") zoomBy(1.6);
      else if (event.key === "-") zoomBy(1 / 1.6);
      else if (event.key === "Home") seek(0);
      else if (event.key === "End") seek(total);
      else if (event.key === "Escape") setSelection(null);
      else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && target?.tagName !== "INPUT") {
        event.preventDefault();
        seek((engine.current?.time ?? 0) + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 5 : 1));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [confirming, cutSelection, mark, redo, seek, selection, togglePlay, undo, zoomBy, total]);

  async function listenFinal() {
    engine.current?.pause();
    setSampling(true);
    setNotice(null);
    const at = Math.max(0, Math.min(toEdited(engine.current?.time ?? time, recipe, total), length - limits.previewSeconds));
    const data = new FormData();
    data.set("id", current.id);
    data.set("recipe", JSON.stringify(recipe));
    data.set("at", String(at));
    try {
      const response = await fetch(`${EDITOR}/muestra`, { method: "POST", body: data, headers: { "X-CSRF-TOKEN": csrf(), "X-Requested-With": "XMLHttpRequest", Accept: "audio/mpeg, application/json" } });
      if (response.ok && (response.headers.get("content-type") ?? "").includes("audio")) {
        setSample({ url: URL.createObjectURL(await response.blob()), at });
      } else {
        const body = await response.json().catch(() => ({}));
        setNotice({ error: body.error ?? (response.status === 429 ? "Pediste muchas muestras seguidas. Espera un minuto." : "No se pudo preparar la muestra.") });
      }
    } catch {
      setNotice({ error: "Se cortó la conexión mientras preparábamos la muestra." });
    }
    setSampling(false);
  }

  async function save() {
    setBusy(true);
    const result = await send(EDITOR, { id: current.id, recipe: JSON.stringify(recipe) });
    setBusy(false);
    setConfirming(null);
    if (result.error) {
      setNotice(result);
      return;
    }
    engine.current?.pause();
    setNotice(null);
    setStatusError(null);
    setStatus("processing");
  }

  async function restore() {
    setBusy(true);
    leaving.current = true;
    const result = await send(`${EDITOR}/restaurar`, { id: current.id });
    setBusy(false);
    setConfirming(null);
    if (result.error) {
      leaving.current = false;
      setNotice(result);
    }
  }

  const playheadEdited = toEdited(time, recipe, total);
  const treatments = describeSound(recipe);
  const finalOnly = serverOnly(recipe);

  return (
    <div className="mt-6 space-y-5 pb-28">
      {/* Audio card */}
      <section className="flex flex-col gap-4 rounded-[1.6rem] border border-line bg-card p-4 md:flex-row md:items-center md:p-5">
        <Cover src={current.cover} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindTag kind={current.kind} label={kinds[current.kind]} />
            {current.edited && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">Editado{current.editedAt ? ` · ${new Date(current.editedAt).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}` : ""}</span>}
            {current.episodes > 0 && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">En {current.episodes === 1 ? "1 episodio" : `${current.episodes} episodios`}</span>}
          </div>
          <h2 className="mt-1.5 truncate text-xl font-semibold tracking-[-0.03em]">{current.title}</h2>
          {current.credit && <p className="truncate text-sm text-muted">{current.credit}</p>}
        </div>
        <div className="flex items-stretch gap-2">
          <Figure label={current.edited ? "Original" : "Duración"} value={clockDuration(total)} />
          <Figure label="Editado" value={clockDuration(length)} tone={Math.abs(length - total) > 0.05 ? "text-orange-deep" : undefined} note={Math.abs(length - total) > 0.5 ? `${length < total ? "−" : "+"}${clockDuration(Math.abs(total - length))}` : undefined} />
          {analysis?.loudness != null && <Figure label="Volumen" value={`${analysis.loudness.toFixed(1)}`} note="LUFS" />}
        </div>
      </section>

      {processing && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          <p>
            <b>Procesando el audio con calidad de estudio…</b> Suele tardar {total * 0.15 < 45 ? "unos segundos" : `cerca de ${Math.max(1, Math.round((total * 0.15) / 60))} min`}. Puedes quedarte aquí: la página se actualiza sola cuando termine.
          </p>
        </div>
      )}
      {status === "failed" && statusError && <Notice result={{ error: `No se pudo guardar la edición: ${statusError}` }} onClose={() => setStatus(null)} />}
      <Notice result={notice} onClose={() => setNotice(null)} />

      {/* Timeline */}
      <section className="rounded-[1.6rem] border border-line bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
            <ToolButton label="Ir al inicio (Inicio)" onClick={() => seek(0)} icon="start" />
            <button
              type="button"
              onClick={togglePlay}
              disabled={engine.current?.broken}
              title="Reproducir o pausar (Espacio)"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition hover:brightness-125 disabled:opacity-40"
            >
              <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
            </button>
            <ToolButton label="Ir al final (Fin)" onClick={() => seek(total)} icon="end" />
          </div>

          <div className="min-w-[9.5rem] rounded-2xl bg-ink px-3.5 py-1.5 text-white">
            <p className="font-mono text-[17px] font-semibold tabular-nums leading-tight">{preciseTime(time)}</p>
            <p className="text-[10px] tabular-nums text-white/60">editado {preciseTime(playheadEdited)} / {preciseTime(length)}</p>
          </div>

          <div className="hidden w-28 flex-col gap-1 sm:flex" title="Nivel de salida">
            {[meterLeft, meterRight].map((meter, index) => (
              <span key={index} className="relative h-1.5 overflow-hidden rounded-full bg-black/10">
                <span ref={meter} className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-[width] duration-75" style={{ width: 0 }} />
              </span>
            ))}
          </div>

          <span className="mx-1 hidden h-8 w-px bg-line md:block" />

          <ToggleChip active={loop} onClick={() => setLoop((value) => !value)} title="Repite la parte seleccionada mientras ajustas (L)">
            <Icon name="loop" className="h-3.5 w-3.5" /> Repetir selección
          </ToggleChip>
          <div className="flex rounded-full border border-line bg-white p-1 text-xs font-semibold" title="Compara el sonido original con el editado (B)">
            <button type="button" onClick={() => setBypass(true)} className={`rounded-full px-3 py-1.5 transition ${bypass ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>Original</button>
            <button type="button" onClick={() => setBypass(false)} className={`rounded-full px-3 py-1.5 transition ${!bypass ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>Editado</button>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-full border border-line bg-white p-1">
            <ToolButton label="Alejar (−)" onClick={() => zoomBy(1 / 1.6)} icon="minus" disabled={zoom <= 1} />
            <button type="button" onClick={() => setZoom(1)} className="rounded-full px-2.5 py-1.5 text-xs font-semibold tabular-nums text-muted hover:text-ink" title="Ver todo el audio">
              {zoom <= 1 ? "Todo" : `${Math.round(zoom * 100)}%`}
            </button>
            <ToolButton label="Acercar (+) · también Ctrl + rueda del mouse" onClick={() => zoomBy(1.6)} icon="plus" />
          </div>
        </div>

        <div className="mt-4">
          {analysisError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-8 text-center text-sm text-red-800">{analysisError}</p>
          ) : (
            <Waveform
              peaks={analysis?.peaks ?? null}
              perSecond={analysis?.perSecond ?? 100}
              duration={total}
              cuts={recipe.cuts}
              selection={selection}
              time={time}
              fades={fades}
              zoom={zoom}
              follow={playing}
              onZoom={setZoom}
              onSeek={seek}
              onSelect={setSelection}
              onCuts={(cuts) => applyCuts(cuts)}
            />
          )}
          {engine.current?.broken && <p className="mt-2 text-xs text-red-700">El navegador no pudo reproducir este audio. Puedes cortar y ajustar igual, y escuchar el resultado con «Escuchar el resultado final».</p>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selection ? (
            <>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-blue-800">
                Selección {preciseTime(selection[0])} → {preciseTime(selection[1])} · {preciseTime(selection[1] - selection[0])}
              </span>
              <button type="button" onClick={cutSelection} className={`${button} bg-red-600 py-2`} title="Supr">
                <Icon name="scissors" className="h-4 w-4" /> Cortar selección
              </button>
              <button type="button" onClick={keepSelection} className={`${ghost} py-2`}>Quedarme solo con esto</button>
              {selectionCuts && <button type="button" onClick={restoreSelection} className={`${ghost} py-2`}>Recuperar lo cortado aquí</button>}
              <button type="button" onClick={() => setSelection(null)} className="px-2 text-xs font-semibold text-muted hover:text-ink">Quitar selección (Esc)</button>
            </>
          ) : (
            <>
              <p className="mr-auto min-w-[16rem] flex-1 text-[12.5px] text-muted">
                <b className="text-ink">Arrastra sobre la onda</b> para seleccionar la parte que quieres quitar. Haz clic para mover el cursor. Las marcas rojas se pueden arrastrar para afinar un corte.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => applyCuts([...recipe.cuts, [0, time]])} disabled={time < 0.1 || cutAt(recipe.cuts, time) >= 0} className={`${ghost} py-2`} title="Quita la introducción hasta el cursor">
                  <Icon name="scissors" className="h-4 w-4" /> Quitar el inicio hasta aquí
                </button>
                <button type="button" onClick={() => applyCuts([...recipe.cuts, [time, total]])} disabled={time > total - 0.1 || cutAt(recipe.cuts, time) >= 0} className={`${ghost} py-2`} title="Quita el final desde el cursor">
                  <Icon name="scissors" className="h-4 w-4" /> Quitar desde aquí hasta el final
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {sample && (
        <section className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-violet-900">Muestra del resultado final</p>
            <p className="text-xs text-violet-900/75">
              {limits.previewSeconds} segundos desde el {preciseTime(sample.at)} del audio editado, procesados en el servidor exactamente como quedarán
              {finalOnly.length ? ` (incluye ${finalOnly.join(" y ")})` : ""}.
            </p>
          </div>
          <audio src={sample.url} controls autoPlay className="w-full md:w-96" />
          <button type="button" onClick={() => setSample(null)} className="text-xs font-semibold text-violet-900/70 hover:text-violet-900">Cerrar</button>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          <Panel title="Cortes y transiciones" text="Así queda el audio, en orden. Puedes escuchar cada empalme o recuperar una parte cortada.">
            <ol className="space-y-1.5">
              {timeline(parts, recipe.cuts).map((piece, index) =>
                piece.cut ? (
                  <li key={`c${index}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2 text-[13px]">
                    <Icon name="scissors" className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-red-800">Cortado</span>
                    <span className="tabular-nums text-red-900/70">{preciseTime(piece.range[0])} → {preciseTime(piece.range[1])} · {preciseTime(piece.range[1] - piece.range[0])}</span>
                    <span className="ml-auto flex gap-1">
                      {piece.range[0] > 0 && piece.range[1] < total && (
                        <SmallButton onClick={() => {
                          setSample(null);
                          void engine.current?.play(Math.max(0, piece.range[0] - 3));
                        }}>▶ Escuchar el empalme</SmallButton>
                      )}
                      <SmallButton onClick={() => setSelection(piece.range)}>Seleccionar</SmallButton>
                      <SmallButton onClick={() => change((value) => ({ ...value, cuts: restoreRange(value.cuts, piece.range, total) }))}>Recuperar</SmallButton>
                    </span>
                  </li>
                ) : (
                  <li key={`k${index}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[13px]">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold">Parte {piece.number}</span>
                    <span className="tabular-nums text-muted">{preciseTime(piece.range[0])} → {preciseTime(piece.range[1])} · {preciseTime(piece.range[1] - piece.range[0])}</span>
                    <span className="ml-auto">
                      <SmallButton onClick={() => {
                        setSample(null);
                        void engine.current?.play(piece.range[0]);
                      }}>▶ Escuchar</SmallButton>
                    </span>
                  </li>
                ),
              )}
            </ol>
            {recipe.cuts.length === 0 && <p className="mt-3 text-xs text-muted">Todavía no hay cortes: el audio suena completo.</p>}

            <div className="mt-5 grid gap-4 rounded-2xl border border-line bg-white p-4 md:grid-cols-3">
              <Slider
                label="Entrada suave"
                hint="El audio empieza desde silencio y sube poco a poco."
                value={recipe.fadeIn}
                min={0}
                max={Math.min(limits.maxFade, Math.floor((length / 2) * 10) / 10)}
                step={0.1}
                format={(value) => (value ? `${value.toFixed(1)} s` : "Sin fundido")}
                group="fadeIn"
                onChange={(patch, group) => change((value) => ({ ...value, ...patch }), group)}
              />
              <Slider
                label="Salida suave"
                hint="El final baja poco a poco hasta el silencio. Ideal si cortaste el final."
                value={recipe.fadeOut}
                min={0}
                max={Math.min(limits.maxFade, Math.floor((length / 2) * 10) / 10)}
                step={0.1}
                format={(value) => (value ? `${value.toFixed(1)} s` : "Sin fundido")}
                group="fadeOut"
                onChange={(patch, group) => change((value) => ({ ...value, ...patch }), group)}
              />
              <Slider
                label="Unión de los cortes"
                hint={overlaps.length ? "En cero, corte limpio. Más arriba, las partes se funden una con otra." : "Se usa cuando cortas una parte del medio."}
                value={recipe.join}
                min={0}
                max={limits.maxJoin}
                step={0.05}
                format={(value) => (value ? `Fundido ${value.toFixed(2)} s` : "Corte limpio")}
                group="join"
                onChange={(patch, group) => change((value) => ({ ...value, ...patch }), group)}
              />
            </div>
          </Panel>

          <details className="group rounded-[1.6rem] border border-line bg-card p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
              ¿Cómo se usa? Guía rápida y atajos
              <span className="text-muted transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4 grid gap-5 text-[13px] leading-6 md:grid-cols-2">
              <ol className="list-decimal space-y-1.5 pl-5">
                <li><b>Escucha</b> con el botón ▶ o la barra espaciadora. Haz clic en la onda para ir a un punto.</li>
                <li><b>Selecciona</b> arrastrando sobre la onda la parte que sobra (una intro larga, un silencio, una parte del medio).</li>
                <li><b>Corta</b> con «Cortar selección» o la tecla Supr. Al reproducir, el corte se salta solo: escucha cómo queda el empalme.</li>
                <li><b>Afina</b> arrastrando las marcas rojas del corte, y suaviza con la entrada, la salida o la unión de los cortes.</li>
                <li><b>Mejora el sonido</b> con un estilo o los controles. Compara con «Original / Editado».</li>
                <li><b>Guarda.</b> El original queda guardado: podrás reabrir la edición o restaurarlo.</li>
              </ol>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {[
                  ["Espacio", "Reproducir / pausar"],
                  ["Supr", "Cortar la selección"],
                  ["I  ·  O", "Marcar inicio · fin de la selección en el cursor"],
                  ["L", "Repetir la selección"],
                  ["B", "Comparar original / editado"],
                  ["+  ·  −", "Acercar · alejar (o Ctrl + rueda)"],
                  ["← →", "Mover el cursor 1 s (Mayús: 5 s)"],
                  ["Ctrl+Z · Ctrl+Y", "Deshacer · rehacer"],
                  ["Mayús + clic", "Extender la selección"],
                  ["Doble clic", "Seleccionar un corte · volver un control a cero"],
                ].map(([key, text]) => (
                  <div key={key} className="contents">
                    <dt><kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold">{key}</kbd></dt>
                    <dd className="text-muted">{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        </div>

        <div className="xl:col-span-5">
          <Panel
            title="Sonido"
            text="Mejora la calidad del audio. Todo se escucha al instante mientras reproduces."
            actions={
              <button
                type="button"
                onClick={listenFinal}
                disabled={sampling || processing}
                className={`${ghost} border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-400`}
                title="Procesa unos segundos en el servidor con todos los filtros, incluidos los que el navegador no puede reproducir"
              >
                {sampling ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-700 border-t-transparent" /> : <Icon name="headphones" className="h-4 w-4" />}
                Escuchar el resultado final
              </button>
            }
          >
            <SoundPanel recipe={recipe} onChange={(patch, group) => change((value) => ({ ...value, ...patch }), group)} onReplace={(next) => change(next)} />
          </Panel>
        </div>
      </div>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/90 backdrop-blur-md 2xl:left-[272px]">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 sm:flex-nowrap md:px-10 xl:px-14">
          <ToolButton label="Deshacer (Ctrl+Z)" onClick={undo} icon="undo" disabled={!canUndo} />
          <ToolButton label="Rehacer (Ctrl+Y)" onClick={redo} icon="redo" disabled={!canRedo} />
          <p className="ml-1 mr-auto min-w-0 flex-1 truncate text-[13px]">
            {processing ? (
              <span className="font-semibold text-amber-700">Procesando…</span>
            ) : dirty ? (
              <span><b className="text-orange-deep">Cambios sin guardar</b><span className="hidden text-muted sm:inline"> · {clockDuration(length)}{treatments.length ? ` · ${treatments.slice(0, 3).join(", ")}${treatments.length > 3 ? "…" : ""}` : ""}</span></span>
            ) : (
              <span className="text-muted">{current.edited ? "Esta es la edición guardada." : "Sin cambios."}</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {current.edited && (
              <button type="button" onClick={() => setConfirming("restore")} disabled={processing || busy} className={`${ghost} text-red-700 hover:border-red-300`}>
                Restaurar original
              </button>
            )}
            {dirty && (
              <button type="button" onClick={() => change(baseline)} disabled={processing} className={ghost}>
                Descartar cambios
              </button>
            )}
            <button type="button" onClick={() => setConfirming("save")} disabled={!dirty || processing || isPlain(recipe) && !current.edited} className={button}>
              Guardar edición
            </button>
          </div>
        </div>
      </div>

      {confirming === "save" && (
        <Dialog title="¿Guardar la edición?" onClose={() => setConfirming(null)}>
          <ul className="space-y-2 text-[13.5px]">
            <Row label="Duración">{clockDuration(total)} → <b>{clockDuration(length)}</b></Row>
            {recipe.cuts.length > 0 && <Row label="Cortes">{recipe.cuts.length === 1 ? "1 parte cortada" : `${recipe.cuts.length} partes cortadas`}{recipe.join > 0 ? `, unidas con fundido de ${recipe.join.toFixed(2)} s` : ""}</Row>}
            {(recipe.fadeIn > 0 || recipe.fadeOut > 0) && <Row label="Fundidos">{[recipe.fadeIn > 0 && `entrada ${recipe.fadeIn.toFixed(1)} s`, recipe.fadeOut > 0 && `salida ${recipe.fadeOut.toFixed(1)} s`].filter(Boolean).join(" · ")}</Row>}
            {treatments.length > 0 && <Row label="Sonido">{treatments.join(" · ")}</Row>}
            {isPlain(recipe) && <Row label="Resultado">Sin cambios: usa «Restaurar original» para volver al audio original.</Row>}
          </ul>
          <div className="mt-4 space-y-2 rounded-2xl bg-paper p-3.5 text-[12.5px] leading-5 text-muted">
            <p>El original queda guardado aparte: podrás reabrir esta edición para ajustarla o restaurar el original cuando quieras.</p>
            {current.upcoming > 0 && <p>Lo programado con este audio ({current.upcoming === 1 ? "1 bloque" : `${current.upcoming} bloques`}) sonará editado y tomará la nueva duración.{length > current.duration + 0.5 ? " Queda más largo: revisa la programación por si se cruza con lo siguiente." : ""}</p>}
            {current.episodes > 0 && <p>{current.episodes === 1 ? "El episodio que usa" : `Los ${current.episodes} episodios que usan`} este audio sonarán con la versión editada.</p>}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(null)} className={ghost}>Seguir editando</button>
            <button type="button" onClick={save} disabled={busy || isPlain(recipe)} className={button}>{busy ? "Guardando…" : "Guardar edición"}</button>
          </div>
        </Dialog>
      )}

      {confirming === "restore" && (
        <Dialog title="¿Restaurar el audio original?" onClose={() => setConfirming(null)}>
          <p className="text-[13.5px] leading-6 text-muted">
            «{current.title}» volverá a sonar como cuando lo subiste ({clockDuration(total)}), en la biblioteca y en todo lo programado. Se descartan los cortes y los ajustes de sonido guardados.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(null)} className={ghost}>Cancelar</button>
            <button type="button" onClick={restore} disabled={busy} className={`${button} bg-red-600`}>{busy ? "Restaurando…" : "Restaurar original"}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** The parts that stay and the parts cut, in order. */
function timeline(parts: Cut[], cuts: Cut[]) {
  const pieces = [...parts.map((range) => ({ range, cut: false })), ...cuts.map((range) => ({ range, cut: true }))].sort((a, b) => a.range[0] - b.range[0]);
  let number = 0;
  return pieces.map((piece) => ({ ...piece, number: piece.cut ? 0 : ++number }));
}

/** «Resaltar voz 60 %», «Ecualizador», …: what the sound settings do, in words. */
function describeSound(recipe: Recipe) {
  const preset = PRESETS.find((item) => item.key === recipe.preset);
  const eq = recipe.eq.map((gain, index) => (gain ? `${EQ_BANDS[index].label} ${gain > 0 ? "+" : ""}${gain} dB` : null)).filter(Boolean);
  return [
    preset && `Estilo «${preset.name}»`,
    recipe.voice > 0 && `Resaltar voz ${recipe.voice} %`,
    recipe.width !== 0 && `Estéreo ${recipe.width > 0 ? "+" : ""}${recipe.width} %`,
    eq.length > 0 && `Ecualizador (${eq.join(", ")})`,
    recipe.compress > 0 && `Compresión ${recipe.compress} %`,
    recipe.gain !== 0 && `Volumen ${recipe.gain > 0 ? "+" : ""}${recipe.gain} dB`,
    recipe.normalize && "Volumen normalizado",
    recipe.lowcut && "Sin retumbe",
    recipe.denoise > 0 && `Menos ruido ${recipe.denoise} %`,
    recipe.deess > 0 && `«Eses» suavizadas ${recipe.deess} %`,
  ].filter(Boolean) as string[];
}

/* ───────────────────────────── Small pieces ───────────────────────────── */

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="min-w-[5.5rem] rounded-2xl border border-line bg-white px-3.5 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em] ${tone ?? ""}`}>{value}</p>
      {note && <p className="text-[10.5px] tabular-nums text-muted">{note}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span>{children}</span>
    </li>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold transition hover:border-ink/30">
      {children}
    </button>
  );
}

function ToggleChip({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

function ToolButton({ label, onClick, icon, disabled }: { label: string; onClick: () => void; icon: IconName; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-paper disabled:opacity-30">
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[1.6rem] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold tracking-[-0.025em]">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

type IconName = "play" | "pause" | "start" | "end" | "loop" | "scissors" | "plus" | "minus" | "undo" | "redo" | "headphones" | "wave";

const ICONS: Record<IconName, ReactNode> = {
  play: <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none" />,
  start: <path d="M6 5v14M18 5 9 12l9 7z" />,
  end: <path d="M18 5v14M6 5l9 7-9 7z" />,
  loop: <path d="M4 12a6 6 0 0 1 6-6h8m0 0-3-3m3 3-3 3M20 12a6 6 0 0 1-6 6H6m0 0 3 3m-3-3 3-3" />,
  scissors: <path d="M8.5 8.5 20 20M8.5 15.5 20 4M9 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />,
  headphones: <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z" />,
  wave: <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" />,
};

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
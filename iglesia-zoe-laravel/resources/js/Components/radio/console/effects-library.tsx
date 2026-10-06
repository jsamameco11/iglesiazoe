import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StopIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { duration, type RadioTrack } from "@/lib/radio";
import { EFFECT_CATEGORIES, FACTORY_EFFECTS, STARTER_EFFECTS, effectBuffer, previewEffect, stopPreview, wavFile, type FactoryEffect } from "@/lib/radio/effects";

const MAX_PADS = 16;

const ARTIST = "Efectos Zoe";

const LABELS = new Map(EFFECT_CATEGORIES.map((category) => [category.id, category.label]));

const artistOf = (item: FactoryEffect) => `${ARTIST} · ${LABELS.get(item.category) ?? item.category}`;

const inBank = (pads: RadioTrack[], item: FactoryEffect) => pads.some((pad) => pad.kind === "efecto" && pad.title === item.title && pad.artist === artistOf(item));

const length = (seconds: number) => (seconds < 10 ? `${seconds.toFixed(1).replace(".", ",")} s` : duration(seconds));

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Renders the effect, stores it in the library and puts it at the end of the botonera. */
async function addEffect(item: FactoryEffect): Promise<{ pads?: RadioTrack[]; error?: string }> {
  try {
    const buffer = await effectBuffer(item);
    const data = new FormData();
    data.set("title", item.title);
    data.set("category", LABELS.get(item.category) ?? item.category);
    data.set("duration", buffer.duration.toFixed(2));
    data.set("audio", wavFile(buffer, `${item.id}.wav`));
    const result = await send("/admin/radio/botonera/efecto", data);
    return result.error ? { error: result.error } : { pads: (result.pads as RadioTrack[]) ?? [] };
  } catch {
    return { error: `No se pudo agregar «${item.title}». Revisa tu conexión e inténtalo de nuevo.` };
  }
}

/**
 * The factory effects: categorized, heard here before adding them, and added to the botonera
 * one by one or as the basic set in one click.
 */
export function EffectsLibrary({ pads, onSaved, onClose, starter = false }: { pads: RadioTrack[]; onSaved: (pads: RadioTrack[]) => void; onClose: () => void; starter?: boolean }) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const bank = useRef(pads);
  const added = useRef(false);
  const busy = adding !== null || progress !== null;
  bank.current = pads;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    FACTORY_EFFECTS.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + 1));
    return map;
  }, []);
  const search = fold(query.trim());
  const visible = FACTORY_EFFECTS.filter((item) => (search ? fold(`${item.title} ${LABELS.get(item.category)}`).includes(search) : !category || item.category === category));
  const free = MAX_PADS - pads.length;
  const missingStarter = STARTER_EFFECTS.filter((id) => !inBank(pads, FACTORY_EFFECTS.find((item) => item.id === id)!)).length;
  const hint = EFFECT_CATEGORIES.find((item) => item.id === category)?.hint;

  function close() {
    if (busy) return;
    stopPreview();
    if (added.current) router.reload({ only: ["library"] });
    onClose();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => stopPreview(), []);

  function toggle(item: FactoryEffect) {
    if (playing === item.id) {
      stopPreview();
      setPlaying(null);
      return;
    }
    setPlaying(item.id);
    void previewEffect(item, () => setPlaying((value) => (value === item.id ? null : value)));
  }

  async function add(item: FactoryEffect) {
    setError("");
    setNotice("");
    setAdding(item.id);
    const result = await addEffect(item);
    setAdding(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    added.current = true;
    onSaved(result.pads ?? []);
    setNotice(`«${item.title}» ya está en la botonera.`);
  }

  async function loadStarter() {
    const items = STARTER_EFFECTS.map((id) => FACTORY_EFFECTS.find((item) => item.id === id)!).filter((item) => !inBank(bank.current, item));
    const room = MAX_PADS - bank.current.length;
    setError("");
    setNotice("");
    if (!items.length) {
      setNotice("La botonera básica ya está cargada.");
      return;
    }
    if (room <= 0) {
      setError(`La botonera ya tiene ${MAX_PADS} botones. Quita algunos con «Editar» para cargar la básica.`);
      return;
    }
    const batch = items.slice(0, room);
    setProgress({ done: 0, total: batch.length });
    for (const [index, item] of batch.entries()) {
      const result = await addEffect(item);
      if (result.error) {
        setError(result.error);
        break;
      }
      added.current = true;
      bank.current = result.pads ?? [];
      onSaved(bank.current);
      setProgress({ done: index + 1, total: batch.length });
    }
    setProgress(null);
    setNotice(batch.length < items.length ? `Se cargaron los que entraban: la botonera llegó a ${MAX_PADS} botones.` : "Botonera básica lista. Tócala con las teclas 1–0.");
  }

  const started = useRef(false);
  useEffect(() => {
    if (starter && !started.current) {
      started.current = true;
      void loadStarter();
    }
  });

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="Efectos de fábrica" onClick={close}>
      <div className="picker fx-library" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="studio-label">Botonera · {pads.length}/{MAX_PADS}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">Efectos de fábrica</h2>
            <p className="mt-1 text-[13px] text-white/50">
              {FACTORY_EFFECTS.length} sonidos en {EFFECT_CATEGORIES.length} categorías. Escúchalos aquí (solo tú) y agrégalos a la botonera con un clic.
            </p>
          </div>
          <button type="button" onClick={close} disabled={busy} className="text-2xl leading-none text-white/50 hover:text-white disabled:opacity-30" aria-label="Cerrar">×</button>
        </div>

        <div className="fx-starter mt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Botonera básica</p>
            <p className="text-[12px] leading-5 text-white/50">Aplausos, redoble, ta-dá, risas, boing, trombón triste, ba-dum-tss, whoosh, campana, coro, jingle y más: {STARTER_EFFECTS.length} efectos listos para hacer radio.</p>
          </div>
          <button type="button" disabled={busy || !missingStarter} onClick={() => void loadStarter()} className="cx-btn" data-tone="green">
            {progress ? `Cargando ${progress.done + 1} de ${progress.total}…` : missingStarter ? "Cargar botonera básica" : "Ya está cargada"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCategory("")} className="picker-tab" data-on={!category || undefined}>
            Todos <span className="fx-count">{FACTORY_EFFECTS.length}</span>
          </button>
          {EFFECT_CATEGORIES.map((item) => (
            <button key={item.id} type="button" onClick={() => setCategory(item.id)} className="picker-tab" data-on={category === item.id || undefined} title={item.hint}>
              {item.label} <span className="fx-count">{counts.get(item.id) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar un efecto: risa, campana, whoosh…" className="picker-input max-w-sm" />
          <p className="text-[12px] text-white/45">{search ? `${visible.length} resultados en todas las categorías` : hint ?? "Todas las categorías"}</p>
        </div>

        <ul className="fx-grid mt-3">
          {visible.map((item) => {
            const there = inBank(pads, item);
            return (
              <li key={item.id} className="fx-card" data-playing={playing === item.id || undefined}>
                <button type="button" onClick={() => toggle(item)} className="fx-play" aria-label={playing === item.id ? `Detener ${item.title}` : `Escuchar ${item.title}`}>
                  {playing === item.id ? <StopIcon className="h-3 w-3" /> : <span aria-hidden>▶</span>}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-white" title={item.title}>{item.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/45">
                    {!category || search ? `${LABELS.get(item.category)} · ` : ""}
                    {length(item.seconds)}
                  </span>
                </span>
                {there ? (
                  <span className="fx-added">✓ En la botonera</span>
                ) : (
                  <button type="button" disabled={busy || free <= 0} onClick={() => void add(item)} className="cx-btn" data-tone="blue" title={free <= 0 ? `La botonera tiene hasta ${MAX_PADS} botones` : undefined}>
                    {adding === item.id ? "Agregando…" : "+ Botonera"}
                  </button>
                )}
              </li>
            );
          })}
          {!visible.length ? <li className="col-span-full px-3 py-8 text-center text-sm text-white/40">No hay efectos con ese nombre.</li> : null}
        </ul>

        {error ? <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p> : null}
        {notice && !error ? <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-white/40">{free > 0 ? `Quedan ${free} botones libres.` : "Botonera llena: quita botones con «Editar» para sumar otros."} Cada efecto queda también en la Biblioteca.</p>
          <button type="button" onClick={close} disabled={busy} className="studio-btn !w-auto">Listo</button>
        </div>
      </div>
    </div>
  );
}

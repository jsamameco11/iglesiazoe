import { useEffect, useMemo, useState } from "react";
import { StopIcon } from "@/Components/radio/icons";
import { duration } from "@/lib/radio";
import { EFFECT_CATEGORIES, FACTORY_EFFECTS, STARTER_EFFECTS, previewEffect, stopPreview, type FactoryEffect } from "@/lib/radio/effects";
import { EFFECT_LABELS, MAX_PADS, inBank, type PadsApi } from "./use-pads";

const length = (seconds: number) => (seconds < 10 ? `${seconds.toFixed(1).replace(".", ",")} s` : duration(seconds));

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const starterEffects = () => STARTER_EFFECTS.map((id) => FACTORY_EFFECTS.find((item) => item.id === id)!);

/**
 * The factory effects: categorized, heard here before adding them, and added to the botonera
 * one by one or as the basic set in one click. They load in the background: the window can be
 * closed while they are added.
 */
export function EffectsLibrary({ bank, onClose }: { bank: PadsApi; onClose: () => void }) {
  const { pads, loading, report } = bank;
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    FACTORY_EFFECTS.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + 1));
    return map;
  }, []);
  const search = fold(query.trim());
  const visible = FACTORY_EFFECTS.filter((item) => (search ? fold(`${item.title} ${EFFECT_LABELS.get(item.category)}`).includes(search) : !category || item.category === category));
  const pending = new Set([...(loading?.queued ?? []), ...(loading?.current ? [loading.current.id] : [])]);
  const free = MAX_PADS - pads.length - pending.size;
  const starter = starterEffects().filter((item) => !inBank(pads, item));
  const missingStarter = starter.filter((item) => !pending.has(item.id)).length;
  const hint = EFFECT_CATEGORIES.find((item) => item.id === category)?.hint;

  function close() {
    stopPreview();
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
          <button type="button" onClick={close} className="text-2xl leading-none text-white/50 hover:text-white" aria-label="Cerrar">×</button>
        </div>

        <div className="fx-starter mt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Botonera básica</p>
            <p className="text-[12px] leading-5 text-white/50">Aplausos, redoble, ta-dá, risas, boing, trombón triste, ba-dum-tss, whoosh, campana, coro, jingle y más: {STARTER_EFFECTS.length} efectos listos para hacer radio.</p>
          </div>
          <button type="button" disabled={!missingStarter} onClick={() => bank.load(starter)} className="cx-btn" data-tone="green">
            {missingStarter ? "Cargar botonera básica" : starter.length ? "Cargando…" : "Ya está cargada"}
          </button>
        </div>

        {loading ? <PadLoadingBar bank={bank} className="mt-2" /> : null}

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
            const adding = loading?.current?.id === item.id;
            return (
              <li key={item.id} className="fx-card" data-playing={playing === item.id || undefined}>
                <button type="button" onClick={() => toggle(item)} className="fx-play" aria-label={playing === item.id ? `Detener ${item.title}` : `Escuchar ${item.title}`}>
                  {playing === item.id ? <StopIcon className="h-3 w-3" /> : <span aria-hidden>▶</span>}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-white" title={item.title}>{item.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/45">
                    {!category || search ? `${EFFECT_LABELS.get(item.category)} · ` : ""}
                    {length(item.seconds)}
                  </span>
                </span>
                {there ? (
                  <span className="fx-added">✓ En la botonera</span>
                ) : pending.has(item.id) ? (
                  <span className="fx-pending" data-active={adding || undefined}>{adding ? "Agregando…" : "En cola"}</span>
                ) : (
                  <button type="button" disabled={free <= 0} onClick={() => bank.load([item])} className="cx-btn" data-tone="blue" title={free <= 0 ? `La botonera tiene hasta ${MAX_PADS} botones` : undefined}>
                    + Botonera
                  </button>
                )}
              </li>
            );
          })}
          {!visible.length ? <li className="col-span-full px-3 py-8 text-center text-sm text-white/40">No hay efectos con ese nombre.</li> : null}
        </ul>

        {report ? <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${report.tone === "error" ? "bg-red-500/15 text-red-200" : "bg-emerald-500/15 text-emerald-200"}`}>{report.text}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-white/40">
            {loading
              ? "Se cargan en segundo plano: puedes cerrar esta ventana y seguir trabajando en la consola."
              : `${free > 0 ? `Quedan ${free} botones libres.` : "Botonera llena: quita botones con «Editar» para sumar otros."} Cada efecto queda también en la Biblioteca.`}
          </p>
          <button type="button" onClick={close} className="studio-btn !w-auto">{loading ? "Seguir en segundo plano" : "Listo"}</button>
        </div>
      </div>
    </div>
  );
}

/** Progress of the effects loading in the background, with the way to stop it. */
export function PadLoadingBar({ bank, className = "" }: { bank: PadsApi; className?: string }) {
  const { loading } = bank;
  if (!loading) return null;
  const step = Math.min(loading.done + 1, loading.total);
  return (
    <div className={`fx-loading ${className}`} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11.5px] text-white/60">
          <span className="font-semibold text-emerald-300">Cargando efectos · {step} de {loading.total}</span>
          {loading.current ? ` · ${loading.current.title}` : ""}
        </p>
        <button type="button" disabled={loading.stopping} onClick={bank.stop} className="cx-btn" data-tone="red">
          {loading.stopping ? "Deteniendo…" : "Detener"}
        </button>
      </div>
      <span className="fx-loading-bar" aria-hidden>
        <span style={{ width: `${(loading.done / Math.max(1, loading.total)) * 100}%` }} />
      </span>
    </div>
  );
}

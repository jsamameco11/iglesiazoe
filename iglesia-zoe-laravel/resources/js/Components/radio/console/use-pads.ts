import { router } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { send } from "@/lib/actions";
import type { RadioTrack } from "@/lib/radio";
import { EFFECT_CATEGORIES, effectBuffer, wavFile, type FactoryEffect } from "@/lib/radio/effects";

export const MAX_PADS = 16;

const ARTIST = "Efectos Zoe";

export const EFFECT_LABELS = new Map(EFFECT_CATEGORIES.map((category) => [category.id, category.label]));

const artistOf = (item: FactoryEffect) => `${ARTIST} · ${EFFECT_LABELS.get(item.category) ?? item.category}`;

export const inBank = (pads: RadioTrack[], item: FactoryEffect) => pads.some((pad) => pad.kind === "efecto" && pad.title === item.title && pad.artist === artistOf(item));

type PadResult = { pads?: RadioTrack[]; error?: string };

/** Renders the effect, stores it in the library and puts it at the end of the botonera. */
async function addEffect(item: FactoryEffect): Promise<PadResult> {
  try {
    const buffer = await effectBuffer(item);
    const data = new FormData();
    data.set("title", item.title);
    data.set("category", EFFECT_LABELS.get(item.category) ?? item.category);
    data.set("duration", buffer.duration.toFixed(2));
    data.set("audio", wavFile(buffer, `${item.id}.wav`));
    const result = await send("/admin/radio/botonera/efecto", data);
    return result.error ? { error: result.error } : { pads: (result.pads as RadioTrack[]) ?? [] };
  } catch {
    return { error: `No se pudo agregar «${item.title}». Revisa tu conexión e inténtalo de nuevo.` };
  }
}

export type PadLoading = { current: FactoryEffect | null; queued: string[]; done: number; total: number; stopping: boolean };

export type PadReport = { tone: "info" | "error"; text: string };

export type PadsApi = ReturnType<typeof usePads>;

/**
 * The botonera of the console. Every change runs one after the other on the latest bank, so the
 * factory effects load in the background (with the effects window closed) while the operator keeps
 * dropping sounds or working on the rest of the console.
 */
export function usePads(initial: RadioTrack[]) {
  const [pads, setBank] = useState(initial);
  const [loading, setLoading] = useState<PadLoading | null>(null);
  const [report, setReport] = useState<PadReport | null>(null);
  const bank = useRef(initial);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef<FactoryEffect[]>([]);
  const current = useRef<FactoryEffect | null>(null);
  const progress = useRef({ done: 0, total: 0, overflow: false, stopping: false });
  const running = useRef(false);
  const mounted = useRef(true);
  const busy = loading !== null;

  const setPads = useCallback((next: RadioTrack[]) => {
    bank.current = next;
    setBank(next);
  }, []);

  /** Runs a change of the botonera once the previous ones finished, with the bank as it is by then. */
  const exclusive = useCallback(
    <T extends PadResult>(job: (bank: RadioTrack[]) => Promise<T>): Promise<T> => {
      const run = chain.current.then(() => job(bank.current)).then((result) => {
        if (result.pads) setPads(result.pads);
        return result;
      });
      chain.current = run.catch(() => undefined);
      return run;
    },
    [setPads],
  );

  function sync() {
    const { done, total, stopping } = progress.current;
    setLoading(current.current || waiting.current.length ? { current: current.current, queued: waiting.current.map((item) => item.id), done, total, stopping } : null);
  }

  async function drain() {
    running.current = true;
    let added = 0;
    let last = "";
    let error = "";
    while (waiting.current.length && !progress.current.stopping) {
      const item = waiting.current.shift()!;
      current.current = item;
      sync();
      const result = await exclusive((now) =>
        inBank(now, item) ? Promise.resolve<PadResult>({}) : now.length >= MAX_PADS ? Promise.resolve<PadResult>({ error: `La botonera llegó a ${MAX_PADS} botones.` }) : addEffect(item).then((value) => {
          if (!value.error) {
            added += 1;
            last = item.title;
          }
          return value;
        }),
      );
      if (result.error) {
        error = result.error;
        break;
      }
      progress.current.done += 1;
    }

    const left = waiting.current.length;
    const { total, overflow, stopping } = progress.current;
    waiting.current = [];
    current.current = null;
    progress.current = { done: 0, total: 0, overflow: false, stopping: false };
    running.current = false;
    sync();
    if (!mounted.current) return;
    if (added) router.reload({ only: ["library"] });

    const count = added === 1 ? "1 efecto" : `${added} efectos`;
    if (error) {
      setReport({ tone: "error", text: `${error}${added ? ` Se agregaron ${count} antes.` : ""}${left ? ` Quedaron ${left} sin agregar: vuelve a intentarlo.` : ""}` });
    } else if (stopping) {
      setReport({ tone: "info", text: `Carga detenida: se agregaron ${count} de ${total}.` });
    } else if (overflow) {
      setReport({ tone: "info", text: `Se cargaron los que entraban: la botonera llegó a ${MAX_PADS} botones.` });
    } else if (added === 1 && total === 1) {
      setReport({ tone: "info", text: `«${last}» ya está en la botonera.` });
    } else if (added) {
      setReport({ tone: "info", text: `Listo: ${count} nuevos en la botonera. Tócalos con las teclas 1–0.` });
    }
  }

  /** Queues factory effects to add in the background; false when none could be queued (the reason goes to the report). */
  function load(items: FactoryEffect[]): boolean {
    const pending = new Set([...waiting.current.map((item) => item.id), ...(current.current ? [current.current.id] : [])]);
    const fresh = items.filter((item) => !inBank(bank.current, item) && !pending.has(item.id));
    if (!fresh.length) {
      if (!pending.size) setReport({ tone: "info", text: items.length > 1 ? "Esos efectos ya están en la botonera." : `«${items[0]?.title}» ya está en la botonera.` });
      return false;
    }
    const room = MAX_PADS - bank.current.length - pending.size;
    if (room <= 0) {
      setReport({ tone: "error", text: `La botonera ya tiene ${MAX_PADS} botones${pending.size ? " con los que se están cargando" : ""}. Quita algunos con «Editar» para sumar otros.` });
      return false;
    }
    const batch = fresh.slice(0, room);
    waiting.current.push(...batch);
    progress.current.total += batch.length;
    progress.current.overflow ||= batch.length < fresh.length;
    progress.current.stopping = false;
    setReport(null);
    sync();
    if (!running.current) void drain();
    return true;
  }

  /** Lets the effect being added finish and drops the ones still waiting. */
  function stop() {
    progress.current.stopping = true;
    sync();
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => {
    if (report?.tone !== "info") return;
    const timer = window.setTimeout(() => setReport((value) => (value === report ? null : value)), 8000);
    return () => window.clearTimeout(timer);
  }, [report]);

  return { pads, setPads, exclusive, loading, report, dismiss: () => setReport(null), load, stop };
}

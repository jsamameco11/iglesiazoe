import { Link } from "@inertiajs/react";
import { useState } from "react";
import { uploadQueue, useUploadQueue } from "./upload-queue";

const LIBRARY = "/admin/radio/biblioteca";

/**
 * The library's upload seen from any other section of the panel: how far it is, what is going up and whether
 * something waits for the admin, with the way back to it; and its summary once it ends.
 */
export function UploadDock() {
  const { queue, auto, notice, viewing } = useUploadQueue();
  const [folded, setFolded] = useState(false);
  if (viewing || (!queue.length && !notice?.final)) return null;

  const { done, total, sending, working, waiting } = uploadQueue.summary();
  const percent = total ? Math.round((done / total) * 100) : 0;
  const title = !queue.length ? "Subida terminada" : !auto ? "Subida en pausa" : working ? "Subiendo audios a la radio" : "La subida espera por ti";
  const shell = "fixed bottom-4 left-4 z-40 2xl:left-[288px]";

  if (folded) {
    return (
      <button
        type="button"
        onClick={() => setFolded(false)}
        className={`${shell} flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_18px_40px_-18px_rgba(20,16,12,0.7)] transition hover:bg-ink/90`}
        aria-label="Mostrar la subida de audios"
      >
        <span className={`h-2 w-2 rounded-full ${auto && working ? "animate-pulse bg-emerald-400" : waiting ? "bg-amber-400" : "bg-white/50"}`} aria-hidden />
        {queue.length ? `${done} de ${total} subidos` : "Subida terminada"}
      </button>
    );
  }

  return (
    <section className={`${shell} w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white/95 p-4 text-ink shadow-[0_24px_60px_-28px_rgba(20,16,12,0.55)] backdrop-blur`} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold tracking-[-0.01em]">{title}</p>
          {queue.length ? (
            <p className="mt-0.5 text-[12px] text-muted">
              {done} de {total} en la biblioteca · sigue aunque cambies de sección o de pestaña
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => (queue.length ? setFolded(true) : uploadQueue.setNotice(null))}
          className="shrink-0 rounded-full px-2 text-lg leading-none text-muted transition hover:text-ink"
          aria-label={queue.length ? "Minimizar" : "Cerrar"}
        >
          {queue.length ? "–" : "×"}
        </button>
      </div>

      {queue.length ? (
        <>
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-paper">
            <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </span>
          {sending ? (
            <p className="mt-2 truncate text-[12px] text-muted">
              Subiendo «{sending.title.trim() || sending.file.name}» · {Math.round(sending.progress * 100)}%
            </p>
          ) : null}
          {waiting ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium text-amber-900">
              {waiting === 1 ? "1 audio espera" : `${waiting} audios esperan`} tus datos o tu veredicto; el resto sigue subiendo.
            </p>
          ) : null}
        </>
      ) : (
        <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px] leading-5 ${notice?.tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{notice?.text}</p>
      )}

      <Link href={LIBRARY} className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-ink/85">
        {queue.length ? "Ver la subida" : "Ver la biblioteca"} →
      </Link>
    </section>
  );
}

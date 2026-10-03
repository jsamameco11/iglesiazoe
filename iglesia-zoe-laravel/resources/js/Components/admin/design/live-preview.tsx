import { useEffect, useRef, useState } from "react";
import { PREVIEW_PARAM, type Design, type DesignPage, type EditorMessage, type PageMessage, type SectionInfo } from "@/lib/design";
import { Choice } from "./fields";

type Device = "desktop" | "tablet" | "phone";

const widths: Record<Device, string> = { desktop: "100%", tablet: "820px", phone: "390px" };

function previewUrl(url: string) {
  const address = new URL(url, window.location.href);
  address.searchParams.set(PREVIEW_PARAM, "1");
  return address.toString();
}

/** The real public page in an iframe, painted with the unpublished draft. */
export function LivePreview({
  page,
  design,
  section,
  refresh = 0,
  onSections,
  onPick,
}: {
  page: DesignPage;
  design: Design;
  section: string | null;
  refresh?: number;
  onSections: (sections: SectionInfo[]) => void;
  onPick: (section: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [ready, setReady] = useState(false);
  const [reloads, setReloads] = useState(0);
  const version = reloads + refresh;
  const src = page.url ? previewUrl(page.url) : "";
  const origin = src ? new URL(src).origin : "";
  const latest = useRef({ onSections, onPick });
  latest.current = { onSections, onPick };

  const post = (message: EditorMessage) => frame.current?.contentWindow?.postMessage(message, origin);

  useEffect(() => {
    setReady(false);
    onSections([]);
  }, [src, version]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<PageMessage>) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "zoe:ready") {
        setReady(true);
        latest.current.onSections(event.data.sections);
      }
      if (event.data?.type === "zoe:pick") latest.current.onPick(event.data.section);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  useEffect(() => {
    if (ready) post({ type: "zoe:design", design });
  }, [ready, design]);

  useEffect(() => {
    if (ready) post({ type: "zoe:focus", section });
  }, [ready, section]);

  return (
    <div className="flex h-full min-h-[70vh] flex-col overflow-hidden rounded-[1.6rem] border border-line bg-[#e9e6e1] shadow-[0_24px_60px_-40px_rgba(42,39,36,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <span className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-emerald-500" : "animate-pulse bg-amber-400"}`} />
          <span className="truncate">{ready ? `Vista previa en vivo · ${page.label}` : "Cargando la página…"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-60">
            <Choice<Device> value={device} options={[{ key: "desktop", label: "Escritorio" }, { key: "tablet", label: "Tableta" }, { key: "phone", label: "Celular" }]} onChange={setDevice} />
          </div>
          <button type="button" onClick={() => setReloads((value) => value + 1)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-ink/30" title="Volver a cargar">↻</button>
          {page.url && <a href={page.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-ink/30">Abrir ↗</a>}
        </div>
      </div>
      <div className="flex flex-1 justify-center overflow-hidden p-0 sm:p-3">
        {src ? (
          <iframe
            key={`${src}-${version}`}
            ref={frame}
            src={src}
            title={`Vista previa de ${page.label}`}
            className="h-full min-h-[68vh] w-full bg-white transition-[max-width] duration-300 sm:rounded-xl"
            style={{ maxWidth: widths[device] }}
          />
        ) : (
          <p className="self-center px-6 text-center text-sm text-muted">Esta página todavía no tiene contenido publicado para mostrar.</p>
        )}
      </div>
    </div>
  );
}

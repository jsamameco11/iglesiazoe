import { useState } from "react";
import { ghost, Notice, Panel, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import type { Encoder } from "./types";

function CopyField({ label, value, secret = false, note }: { label: string; value: string; secret?: boolean; note?: string }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(label, value);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{shown ? value : "•".repeat(Math.min(28, value.length))}</code>
        {secret ? (
          <button type="button" onClick={() => setShown((value) => !value)} className="text-xs font-semibold text-muted hover:text-ink">
            {shown ? "Ocultar" : "Mostrar"}
          </button>
        ) : null}
        <button type="button" onClick={copy} className="rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-white">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

const OBS_SETTINGS: [string, string][] = [
  ["Servicio", "Personalizado…"],
  ["Codificador de video", "NVIDIA NVENC H.264 o x264 (H.264)"],
  ["Control de frecuencia", "CBR"],
  ["Tasa de bits · 1080p 30 fps", "8 000 kbps"],
  ["Tasa de bits · 1080p 60 fps", "12 000 kbps"],
  ["Intervalo de fotogramas clave", "2 s"],
  ["Perfil", "high"],
  ["Audio", "AAC · 160 kbps · 48 kHz · estéreo"],
];

/** Where OBS (or any RTMP/SRT encoder) sends the video. */
export function EncoderPanel({ encoder, live }: { encoder: Encoder; live: boolean }) {
  const { result, setResult, pending, run } = useAction();

  function regenerate() {
    if (!window.confirm("¿Crear una clave nueva? La clave actual dejará de funcionar y tendrás que pegar la nueva en OBS.")) return;
    run(() => send("/admin/transmision/clave", {}));
  }

  return (
    <Panel title="Conexión para OBS" text="Pega estos datos en OBS → Ajustes → Emisión. Funciona igual con vMix, Streamlabs, Prism o cualquier app que transmita por RTMP o SRT.">
      <div className="grid gap-4">
        <CopyField label="Servidor (RTMP)" value={encoder.server} />
        <CopyField label="Clave de retransmisión" value={encoder.key} secret note="Quien tenga esta clave puede transmitir en nombre de la iglesia. No la compartas." />
        <details className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">Conexión SRT (redes inestables)</summary>
          <p className="mt-2 text-xs text-muted">SRT recupera los paquetes perdidos: úsalo si el internet del templo es inestable. En OBS: Servicio Personalizado, pega la URL en Servidor y deja la clave vacía.</p>
          <div className="mt-3">
            <CopyField label="URL SRT" value={encoder.srt} secret />
          </div>
        </details>
        <details className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">Ajustes recomendados de OBS</summary>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[auto_1fr]">
            {OBS_SETTINGS.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-muted">{name}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            La grabación guarda exactamente lo que envía OBS, sin volver a comprimir: a mayor calidad en OBS, mejor queda el archivo para editar. Tu internet de subida debe ser al menos 1,5 veces la tasa de bits.
          </p>
        </details>
        <Notice result={result} onClose={() => setResult(null)} />
        <div>
          <button type="button" className={ghost} disabled={pending || live} onClick={regenerate} title={live ? "No se puede cambiar mientras OBS transmite" : undefined}>
            {pending ? "Creando…" : "Crear clave nueva"}
          </button>
        </div>
      </div>
    </Panel>
  );
}

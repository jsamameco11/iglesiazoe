import { useState } from "react";
import { button, ghost, input, Notice, Panel, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import type { YouTubeInfo } from "./types";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });
}

/** The church channel: connected with Google sign-in, or a stream key pasted from YouTube Studio as a fallback. */
export function YouTubePanel({ youtube }: { youtube: YouTubeInfo }) {
  const { result, setResult, pending, run } = useAction();
  const [key, setKey] = useState("");

  function disconnect() {
    if (!window.confirm("¿Desconectar el canal de YouTube? Las próximas transmisiones solo se verán en la web hasta que lo vuelvas a conectar.")) return;
    run(() => send("/admin/transmision/youtube/desconectar", {}));
  }

  function saveKey(event: React.FormEvent) {
    event.preventDefault();
    run(() => send("/admin/transmision/clave-youtube", { key }), () => setKey(""));
  }

  return (
    <Panel title="Cuenta de YouTube" text="Con el canal conectado, cada transmisión sale a la vez en YouTube, se guarda en el canal y su enlace llega solo a Enseñanzas.">
      <div className="grid gap-4">
        {!youtube.configured ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Falta configurar el acceso a Google</p>
            <p className="mt-1">
              Crea las credenciales OAuth en Google Cloud (YouTube Data API v3) y colócalas en el servidor como <code>YOUTUBE_CLIENT_ID</code> y <code>YOUTUBE_CLIENT_SECRET</code>. Como URI de redirección autorizada usa:
            </p>
            <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-[12.5px]">{youtube.redirectUri}</code>
          </div>
        ) : youtube.connected && youtube.channel ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {youtube.channel.thumbnail ? <img src={youtube.channel.thumbnail} alt="" className="h-11 w-11 rounded-full" /> : null}
              <div className="min-w-0">
                <p className="truncate font-semibold">{youtube.channel.title}</p>
                <p className="text-xs text-muted">
                  {youtube.channel.handle ? `${youtube.channel.handle} · ` : ""}
                  Conectado el {formatDate(youtube.connectedAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`https://studio.youtube.com/channel/${youtube.channel.id}/livestreaming`} target="_blank" rel="noreferrer" className={ghost}>
                YouTube Studio ↗
              </a>
              <button type="button" className={ghost} disabled={pending} onClick={disconnect}>
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-5 text-sm">
            <p className="font-semibold">El canal aún no está conectado</p>
            <p className="mt-1 text-muted">Entra con la cuenta de Google dueña (o administradora) del canal de la iglesia y acepta los permisos.</p>
            <a href="/admin/transmision/youtube/conectar" className={`${button} mt-4`}>
              Conectar canal de YouTube
            </a>
          </div>
        )}

        {youtube.connected && youtube.error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{youtube.error}</p> : null}
        {youtube.connected && !youtube.ingest && !youtube.error ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Falta preparar la conexión de envío en YouTube. Vuelve a conectar el canal; si sigue igual, activa la transmisión en vivo en YouTube Studio (puede tardar 24 h la primera vez).</p>
        ) : null}

        <details className="rounded-2xl border border-line bg-white px-4 py-3 text-sm" open={!youtube.connected && youtube.manualKey}>
          <summary className="cursor-pointer font-semibold">Plan B · clave de transmisión de YouTube Studio</summary>
          <p className="mt-2 text-xs text-muted">
            Si no puedes conectar la cuenta, pega la clave de YouTube Studio → Emitir en directo. La señal se reenviará a YouTube, pero el título y las opciones se ponen allá y el enlace del video tendrás que pegarlo a mano en Enseñanzas.
            {youtube.connected ? " Con la cuenta conectada, esta clave no se usa." : ""}
          </p>
          <form onSubmit={saveKey} className="mt-3 flex flex-wrap gap-2">
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={youtube.manualKey ? "Clave guardada · pega otra para reemplazarla" : "xxxx-xxxx-xxxx-xxxx-xxxx"}
              className={`${input} mt-0 min-w-56 flex-1`}
              autoComplete="off"
            />
            <button className={ghost} disabled={pending || !key.trim()}>
              Guardar clave
            </button>
            {youtube.manualKey ? (
              <button type="button" className={ghost} disabled={pending} onClick={() => run(() => send("/admin/transmision/clave-youtube", { key: "" }))}>
                Quitar clave
              </button>
            ) : null}
          </form>
        </details>

        <p className="text-xs text-muted">
          Ahora se retransmite a YouTube:{" "}
          <span className="font-semibold text-ink">{youtube.relay === "api" ? "sí, con la cuenta conectada" : youtube.relay === "key" ? "sí, con la clave manual" : "no (solo en la web)"}</span>
        </p>
        <Notice result={result} onClose={() => setResult(null)} />
      </div>
    </Panel>
  );
}

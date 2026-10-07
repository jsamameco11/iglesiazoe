import { Link, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { BroadcastForm } from "@/Components/admin/live/broadcast-form";
import { EncoderPanel } from "@/Components/admin/live/encoder-panel";
import { RecordingList } from "@/Components/admin/live/recordings";
import type { BroadcastDefaults, Catalog, Encoder, LiveStream, ServerStatus, YouTubeInfo } from "@/Components/admin/live/types";
import { YouTubePanel } from "@/Components/admin/live/youtube-panel";
import { button, ghost, Notice, PageHeader, Panel, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send, type ActionResult } from "@/lib/actions";
import { formatDuration } from "@/lib/live";

type Snapshot = { server: ServerStatus; current: LiveStream | null; history: LiveStream[]; now: string };

type Props = Snapshot & {
  encoder: Encoder;
  youtube: YouTubeInfo;
  defaults: BroadcastDefaults;
  catalog: Catalog;
  player: string;
  limits: { graceMinutes: number; retentionHours: number };
};

/** Keeps the status board fresh every few seconds; pauses in background tabs. */
function useSnapshot({ server, current, history, now }: Snapshot) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ server, current, history, now });
  useEffect(() => setSnapshot({ server, current, history, now }), [server, current, history, now]);

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      if (document.hidden) return;
      try {
        const response = await fetch("/admin/transmision/estado", { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
        if (response.ok && !stopped) setSnapshot((await response.json()) as Snapshot);
      } catch {
        // Keeps the last snapshot when the network blips.
      }
    }
    const id = window.setInterval(refresh, 3000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return snapshot;
}

function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, "0")).join(":");
}

function since(iso: string | null | undefined, now: number) {
  return iso ? (now - new Date(iso).getTime()) / 1000 : 0;
}

type Tone = "air" | "warn" | "ready" | "idle" | "down";

const TONES: Record<Tone, string> = {
  air: "bg-[#d61f33] text-white",
  warn: "bg-amber-500 text-white",
  ready: "bg-sky-600 text-white",
  idle: "bg-ink/8 text-ink",
  down: "bg-red-50 text-red-800",
};

function statusOf(server: ServerStatus, current: LiveStream | null, now: number, graceMinutes: number): { tone: Tone; label: string; note: string } {
  if (current?.status === "live" && current.signal) {
    return {
      tone: "air",
      label: "Al aire",
      note: current.to_youtube ? "La web y YouTube están recibiendo la señal." : "La web está recibiendo la señal (sin YouTube).",
    };
  }
  if (current?.status === "live") {
    const left = graceMinutes * 60 - since(current.signal_lost_at, now);
    return {
      tone: "warn",
      label: "Señal perdida",
      note: `Esperando que OBS vuelva a conectarse. Si no vuelve, la transmisión se finaliza sola en ${clock(left)}.`,
    };
  }
  if (!server.online) {
    return { tone: "down", label: "Servidor de video sin conexión", note: "El servidor de transmisión no responde. Revisa que el servicio zoe-stream esté activo en el VPS." };
  }
  if (current?.status === "ready") {
    return { tone: "ready", label: "Preparada", note: "Todo listo. Pulsa «Iniciar transmisión» en OBS y saldrá al aire." };
  }
  if (server.ready) {
    return { tone: "ready", label: "Recibiendo señal", note: "Llegó la señal de OBS; la transmisión se abrirá en unos segundos." };
  }
  return { tone: "idle", label: "Sin transmisión", note: "Prepara la transmisión o inicia OBS: si llega la señal sin preparar, se abre sola con los datos por defecto." };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-[-0.02em]">{value}</p>
    </div>
  );
}

function Monitor({ server, current, player, now }: { server: ServerStatus; current: LiveStream | null; player: string; now: number }) {
  const video = server.video;
  const onAir = current?.status === "live" ? clock(since(current.started_at, now)) : "—";
  const resolution = video?.width && video?.height ? `${video.height}p${video.fps ? Math.round(video.fps) : ""}` : "—";

  return (
    <Panel title="Monitor" text="Lo que está llegando desde OBS, tal como lo ve la web (sin sonido).">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {server.ready ? (
          <iframe src={player} title="Monitor de la transmisión" allow="autoplay; fullscreen" className="absolute inset-0 h-full w-full border-0" />
        ) : (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/60">
            {server.online ? "Sin señal. Cuando OBS empiece a transmitir, la verás aquí." : "El servidor de video no responde."}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Al aire" value={onAir} />
        <Metric label="Tasa de bits" value={server.kbps ? `${server.kbps.toLocaleString("es-PE")} kbps` : "—"} />
        <Metric label="Calidad" value={resolution} />
        <Metric label="Viendo en la web" value={String(server.viewers ?? 0)} />
      </div>
      {server.ready && server.kbps !== null && server.kbps < 2500 ? (
        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">La tasa de bits está baja: la imagen puede verse borrosa. Revisa el internet del templo o la configuración de OBS.</p>
      ) : null}
      {server.tracks.length ? <p className="mt-3 text-xs text-muted">Pistas: {server.tracks.join(" · ")}</p> : null}
    </Panel>
  );
}

function CurrentBroadcast({
  current,
  onEdit,
  onCreate,
  onResult,
}: {
  current: LiveStream | null;
  onEdit: () => void;
  onCreate: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { pending, run } = useAction();

  function end() {
    if (!current) return;
    const question =
      current.status === "ready"
        ? "¿Descartar la transmisión preparada? Si se creó en YouTube, se borrará allá también."
        : "¿Finalizar la transmisión? Se cortará la señal, YouTube cerrará el directo y se guardará en Enseñanzas.";
    if (!window.confirm(question)) return;
    run(() => send("/admin/transmision/finalizar", { id: current.id }), onResult);
  }

  if (!current) {
    return (
      <Panel title="Transmisión" text="Prepara el título, la descripción y las opciones de YouTube antes de empezar.">
        <button type="button" className={button} onClick={onCreate}>
          Preparar transmisión
        </button>
      </Panel>
    );
  }

  return (
    <Panel title={current.status === "live" ? "Transmitiendo ahora" : "Transmisión preparada"}>
      <p className="text-xl font-semibold leading-snug tracking-[-0.02em]">{current.title}</p>
      {current.preacher ? <p className="mt-1 text-sm text-muted">Predica: {current.preacher}</p> : null}
      {current.quick ? (
        <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">Se abrió sola al llegar la señal, con los datos por defecto. Puedes cambiar el título y la descripción ahora.</p>
      ) : null}
      {current.youtube_error ? <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">YouTube: {current.youtube_error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {current.youtube_id ? (
          <>
            <a href={`https://youtu.be/${current.youtube_id}`} target="_blank" rel="noreferrer" className={ghost}>
              Ver en YouTube ↗
            </a>
            <a href={`https://studio.youtube.com/video/${current.youtube_id}/livestreaming`} target="_blank" rel="noreferrer" className={ghost}>
              Sala de control ↗
            </a>
          </>
        ) : current.to_youtube ? null : (
          <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-muted">Solo en la web</span>
        )}
        {current.youtube_mode === "key" ? <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-muted">YouTube con clave manual</span> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={ghost} onClick={onEdit}>
          Editar datos
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={end}
          className={current.status === "live" ? "inline-flex items-center gap-2 rounded-full bg-[#d61f33] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" : ghost}
        >
          {pending ? "Un momento…" : current.status === "live" ? "Finalizar transmisión" : "Descartar"}
        </button>
      </div>
    </Panel>
  );
}

const END_REASONS: Record<string, string> = {
  panel: "Finalizada desde el panel",
  timeout: "Se cerró sola por falta de señal",
};

function History({ history, now, retentionHours }: { history: LiveStream[]; now: number; retentionHours: number }) {
  const { result, setResult, pending, run } = useAction();

  return (
    <Panel title="Transmisiones anteriores" text={`Las grabaciones originales (máxima calidad, tal como llegaron de OBS) se guardan en Wasabi ${Math.round(retentionHours / 24)} días para descargarlas y editar reels; luego se borran solas.`}>
      <Notice result={result} onClose={() => setResult(null)} />
      {history.length ? (
        <ul className="mt-2 grid gap-4">
          {history.map((item) => {
            const seconds = item.started_at && item.ended_at ? (new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()) / 1000 : 0;
            const retry = item.recordings.some((recording) => recording.status === "failed") || (item.segments > 0 && !item.recordings.some((recording) => recording.status === "processing"));
            return (
              <li key={item.id} className="rounded-[1.3rem] border border-line bg-paper/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[
                        item.started_at ? new Date(item.started_at).toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }) : "",
                        formatDuration(seconds),
                        item.end_reason ? END_REASONS[item.end_reason] : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.youtube_id ? (
                      <a href={`https://youtu.be/${item.youtube_id}`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-3 py-1.5 font-semibold">
                        YouTube ↗
                      </a>
                    ) : null}
                    {item.teaching ? (
                      <Link href="/admin/recursos" className="rounded-full border border-line bg-white px-3 py-1.5 font-semibold">
                        Ver en Enseñanzas
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  {item.recordings.length ? (
                    <RecordingList recordings={item.recordings} now={now} />
                  ) : item.segments > 0 ? (
                    <p className="text-xs text-muted">Preparando la grabación…</p>
                  ) : (
                    <p className="text-xs text-muted">Sin grabación.</p>
                  )}
                </div>
                {retry ? (
                  <button type="button" disabled={pending} className={`${ghost} mt-3 px-3 py-1.5 text-xs`} onClick={() => run(() => send("/admin/transmision/grabacion/reintentar", { id: item.id }))}>
                    Volver a guardar la grabación
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aún no hay transmisiones.</p>
      )}
    </Panel>
  );
}

export default function Transmision(props: Props) {
  const { server, current, history } = useSnapshot({ server: props.server, current: props.current, history: props.history, now: props.now });
  const { flash } = usePage().props as unknown as { flash?: { notice?: string | null } };
  const now = useNow();
  const [editing, setEditing] = useState<"new" | "current" | null>(null);
  const [notice, setNotice] = useState<ActionResult | null>(flash?.notice ? { message: flash.notice } : null);
  const [showDefaults, setShowDefaults] = useState(false);

  useEffect(() => {
    if (flash?.notice) setNotice({ message: flash.notice });
  }, [flash?.notice]);

  useEffect(() => {
    if (editing === "current" && !current) setEditing(null);
  }, [editing, current]);

  const status = statusOf(server, current, now, props.limits.graceMinutes);

  function saved(result: ActionResult) {
    setNotice(result);
    setEditing(null);
    setShowDefaults(false);
  }

  return (
    <AdminLayout>
      <PageHeader
        kicker="Página web"
        title="Transmisión en vivo"
        text="Transmite desde OBS a la página web y, a la vez, al canal de YouTube. Al terminar, la reunión queda guardada en Enseñanzas y la grabación original lista para descargar."
        aside={
          <div className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold lg:self-end ${TONES[status.tone]}`}>
            {status.tone === "air" ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : null}
            {status.label}
          </div>
        }
      />

      <div className="mt-6 grid gap-4">
        <Notice result={notice} onClose={() => setNotice(null)} />
        <p className="text-sm text-muted">{status.note}</p>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Monitor server={server} current={current} player={props.player} now={now} />
          <CurrentBroadcast current={current} onEdit={() => setEditing("current")} onCreate={() => setEditing("new")} onResult={setNotice} />
        </div>

        {editing ? (
          <Panel title={editing === "new" ? "Preparar transmisión" : "Editar transmisión"} text="Estos datos se usan en YouTube y en la enseñanza que se guarda al terminar.">
            <BroadcastForm
              key={editing === "current" ? current?.id : "new"}
              catalog={props.catalog}
              youtube={props.youtube}
              initial={editing === "current" && current ? current : props.defaults}
              mode="broadcast"
              onSaved={saved}
              onCancel={() => setEditing(null)}
            />
          </Panel>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <EncoderPanel encoder={props.encoder} live={Boolean(current?.status === "live" && current.signal)} />
          <YouTubePanel youtube={props.youtube} />
        </div>

        <Panel
          title="Valores por defecto"
          text="Con lo que empieza cada transmisión nueva, y lo que se usa si OBS empieza sin haberla preparado."
          actions={
            <button type="button" className={ghost} onClick={() => setShowDefaults((value) => !value)}>
              {showDefaults ? "Cerrar" : "Editar"}
            </button>
          }
        >
          {showDefaults ? (
            <BroadcastForm catalog={props.catalog} youtube={props.youtube} initial={props.defaults} mode="defaults" onSaved={saved} onCancel={() => setShowDefaults(false)} />
          ) : (
            <p className="text-sm text-muted">
              «{props.defaults.title}» · {props.defaults.to_youtube ? `YouTube ${props.catalog.privacy.find((option) => option.value === props.defaults.options.privacy)?.label.toLowerCase() ?? ""}` : "solo en la web"}
            </p>
          )}
        </Panel>

        <History history={history} now={now} retentionHours={props.limits.retentionHours} />
      </div>
    </AdminLayout>
  );
}

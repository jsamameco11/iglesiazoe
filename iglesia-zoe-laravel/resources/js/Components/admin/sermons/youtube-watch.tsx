import { useState } from "react";
import type { WatchRun, WatchSettings } from "@/Components/admin/sermons/types";
import { button, ghost, input, Panel } from "@/Components/admin/ui";
import { send, type ActionResult } from "@/lib/actions";

const MODES: { key: WatchSettings["mode"]; label: string; note: string }[] = [
  { key: "auto", label: "Automático", note: "Los cultos nuevos se publican solos en la página." },
  { key: "review", label: "Con revisión", note: "Aparecen aquí y esperan que los apruebes." },
  { key: "off", label: "Apagado", note: "No busca solo; puedes buscar a mano." },
];

const INTERVALS = [1, 3, 6, 12, 24];

const TRIGGERS: Record<WatchRun["trigger"], string> = { auto: "Automática", manual: "Manual", history: "Videos anteriores" };

const hour = (value: number) => `${String(value).padStart(2, "0")}:00`;

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
}

export function relative(iso: string | null | undefined) {
  if (!iso) return "";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const format = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  if (Math.abs(minutes) < 60 * 36) return format.format(Math.round(minutes / 60), "hour");
  return format.format(Math.round(minutes / 1440), "day");
}

/** The times of the day the watcher looks, e.g. "02:00 y 14:00". */
function slots(every: number, start: number) {
  const times = Array.from({ length: Math.max(1, Math.floor(24 / every)) }, (_, step) => (start + step * every) % 24).sort((a, b) => a - b);
  if (times.length > 6) return `cada ${every} h desde las ${hour(start)}`;
  return times.map(hour).join(times.length === 2 ? " y " : ", ");
}

function RunSummary({ run }: { run: WatchRun }) {
  if (run.error) return <span className="text-red-700">{run.error}</span>;
  const parts = [
    run.added ? `${run.added} publicados` : "",
    run.pending ? `${run.pending} por revisar` : "",
    run.updated ? `${run.updated} actualizados` : "",
  ].filter(Boolean);
  const skipped = Object.entries(run.skipped || {}).map(([reason, count]) => `${count} ${reason}`);
  return (
    <span>
      <span className="font-semibold text-ink">{parts.length ? parts.join(" · ") : "Sin videos nuevos"}</span>
      <span className="text-muted"> — revisó {run.found ?? 0} videos{skipped.length ? `; omitió ${skipped.join(", ")}` : ""}</span>
      {run.titles?.length ? <span className="mt-1 block text-[12px] text-muted">{run.titles.join(" · ")}</span> : null}
    </span>
  );
}

/** Status, settings and log of the YouTube channel watcher. */
export function YouTubeWatch({ watch, onResult }: { watch: WatchSettings; onResult: (result: ActionResult) => void }) {
  const [mode, setMode] = useState(watch.mode);
  const [every, setEvery] = useState(watch.every_hours);
  const [start, setStart] = useState(watch.start_hour);
  const [busy, setBusy] = useState(false);

  async function act(task: () => Promise<ActionResult>) {
    setBusy(true);
    onResult(await task());
    setBusy(false);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("mode", mode);
    act(() => send("/admin/predicas/youtube", data));
  }

  const last = watch.runs[0];

  return (
    <Panel
      title="YouTube automático"
      text={`Revisa el canal ${watch.channel.replace("https://www.", "")} y trae a la página cada culto nuevo con su título, duración, vistas y descripción, tal como está en YouTube.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} disabled={busy || watch.running} onClick={() => act(() => send("/admin/predicas/youtube/buscar", { history: "1" }))}>
            Buscar videos anteriores
          </button>
          <button type="button" className={button} disabled={busy || watch.running} onClick={() => act(() => send("/admin/predicas/youtube/buscar", {}))}>
            {watch.running ? "Revisando…" : "Buscar ahora"}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Estado</p>
          <p className="mt-1.5 flex items-center gap-2 text-[15px] font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${watch.running ? "animate-pulse bg-sky-500" : watch.mode === "off" ? "bg-ink/25" : last?.error ? "bg-amber-500" : "bg-emerald-500"}`} />
            {watch.running ? "Revisando el canal…" : MODES.find((item) => item.key === watch.mode)?.label}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Última revisión</p>
          <p className="mt-1.5 text-[15px] font-semibold">{formatWhen(watch.last_run_at)}</p>
          <p className="text-[12px] text-muted">{relative(watch.last_run_at)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Próxima revisión</p>
          <p className="mt-1.5 text-[15px] font-semibold">{watch.next_run_at ? formatWhen(watch.next_run_at) : "Apagada"}</p>
          <p className="text-[12px] text-muted">{watch.next_run_at ? relative(watch.next_run_at) : "Solo búsqueda manual"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Conexión</p>
          <p className="mt-1.5 text-[15px] font-semibold">{watch.has_api_key ? "API oficial de YouTube" : "Página pública del canal"}</p>
          <p className="text-[12px] text-muted">{last?.error ? "La última revisión falló" : "Sin errores"}</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 grid gap-6">
        <div>
          <p className="text-xs font-semibold text-muted">Cómo se agregan los videos nuevos</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${mode === item.key ? "border-accent bg-accent/5 ring-4 ring-accent/10" : "border-line bg-white hover:border-ink/30"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`grid h-4 w-4 place-items-center rounded-full border ${mode === item.key ? "border-accent" : "border-ink/30"}`}>
                    {mode === item.key ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                  </span>
                  {item.label}
                </span>
                <span className="mt-1 block text-[12.5px] leading-5 text-muted">{item.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-muted">
            Frecuencia
            <select name="every_hours" value={every} onChange={(event) => setEvery(Number(event.target.value))} className={input}>
              {INTERVALS.map((value) => (
                <option key={value} value={value}>
                  {value === 24 ? "Una vez al día" : value === 12 ? "Dos veces al día (cada 12 horas)" : `Cada ${value} ${value === 1 ? "hora" : "horas"}`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Desde la hora (Lima)
            <select name="start_hour" value={start} onChange={(event) => setStart(Number(event.target.value))} className={input}>
              {Array.from({ length: 24 }, (_, value) => (
                <option key={value} value={value}>
                  {hour(value)}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-normal">Revisará a las {slots(every, start)}.</span>
          </label>
          <label className="text-xs font-semibold text-muted">
            Qué videos traer
            <select name="filter" defaultValue={watch.filter} className={input}>
              <option value="streams">Solo transmisiones en vivo (cultos)</option>
              <option value="all">Transmisiones y videos subidos</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Duración mínima (minutos)
            <input name="min_minutes" type="number" min={0} max={240} defaultValue={watch.min_minutes} className={input} />
            <span className="mt-1 block font-normal">Evita clips y cortes de transmisión.</span>
          </label>
          <label className="text-xs font-semibold text-muted">
            Serie para los domingos
            <input name="series_sunday" defaultValue={watch.series_sunday} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Serie para los otros días
            <input name="series_weekday" defaultValue={watch.series_weekday} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Predicador por defecto (opcional)
            <input name="preacher" defaultValue={watch.preacher} placeholder="Ej. Pastor Juan Pérez" className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Traer solo desde (opcional)
            <input name="since" type="date" defaultValue={watch.since || ""} className={input} />
          </label>
        </div>

        <details className="group rounded-2xl border border-line bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">Opciones avanzadas</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Canal de YouTube
              <input name="channel_url" defaultValue={watch.channel_url || ""} placeholder={watch.channel} className={input} />
              <span className="mt-1 block font-normal">Vacío: usa el enlace de YouTube de la página.</span>
            </label>
            <label className="text-xs font-semibold text-muted">
              Clave de la API de YouTube (opcional)
              <input name="api_key" type="password" autoComplete="off" placeholder={watch.has_api_key ? "Guardada · escribe otra para cambiarla" : "AIza…"} className={input} />
              <span className="mt-1 block font-normal">
                Sin clave lee la página pública del canal. Con clave usa la API oficial (Google Cloud → YouTube Data API v3).
              </span>
              {watch.has_api_key ? (
                <span className="mt-2 flex items-center gap-2 font-normal">
                  <input type="checkbox" name="forget_api_key" value="1" /> Quitar la clave guardada
                </span>
              ) : null}
            </label>
            {watch.ignored ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-muted md:col-span-2">
                <input type="checkbox" name="clear_ignored" value="1" />
                Permitir que vuelvan los {watch.ignored} videos descartados o eliminados
              </label>
            ) : null}
          </div>
        </details>

        <div>
          <button className={button} disabled={busy}>
            Guardar ajustes
          </button>
        </div>
      </form>

      {watch.runs.length ? (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Historial de revisiones</p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {watch.runs.slice(0, 8).map((run) => (
              <li key={run.at} className="grid gap-1 px-4 py-3 text-[13px] md:grid-cols-[150px_120px_1fr_60px] md:gap-4">
                <span className="font-semibold tabular-nums">{formatWhen(run.at)}</span>
                <span className="text-muted">{TRIGGERS[run.trigger] ?? run.trigger}</span>
                <RunSummary run={run} />
                <span className="text-muted tabular-nums md:text-right">{run.seconds != null ? `${run.seconds} s` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

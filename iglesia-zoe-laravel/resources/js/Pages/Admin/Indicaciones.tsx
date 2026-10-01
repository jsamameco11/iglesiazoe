import { Link } from "@inertiajs/react";
import { useMemo, useRef, useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { NoticeCard, type NoticePoint, type WeeklyNotice } from "@/Components/auth/weekly-notice";
import { Notice, PageHeader, Panel, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { usePanelUser } from "@/lib/access";

type DraftPoint = NoticePoint & { key: number };
type Draft = Omit<WeeklyNotice, "points" | "updated_at" | "updated_by"> & { points: DraftPoint[] };

function lastEdit(notice: WeeklyNotice) {
  if (!notice.updated_at) return "Aún no se ha editado: se muestran las indicaciones de ejemplo.";
  const date = new Date(notice.updated_at).toLocaleString("es-PE", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return `Última edición${notice.updated_by ? ` por ${notice.updated_by}` : ""} · ${date}`;
}

function toDraft(notice: WeeklyNotice, nextKey: () => number): Draft {
  return {
    enabled: Boolean(notice.enabled),
    kicker: notice.kicker || "",
    title: notice.title || "",
    period: notice.period || "",
    intro: notice.intro || "",
    closing: notice.closing || "",
    points: (notice.points || []).map((point) => ({ key: nextKey(), title: point.title || "", text: point.text || "" })),
  };
}

function fingerprint(draft: Draft) {
  return JSON.stringify({ ...draft, points: draft.points.map(({ title, text }) => ({ title, text })) });
}

function ArrowIcon({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${up ? "" : "rotate-180"}`} aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export default function Indicaciones({
  notice,
  defaults,
  currentWeek,
  maxPoints,
}: {
  notice: WeeklyNotice;
  defaults: WeeklyNotice;
  currentWeek: string;
  maxPoints: number;
}) {
  const counter = useRef(0);
  const nextKey = () => ++counter.current;
  const [draft, setDraft] = useState<Draft>(() => toDraft(notice, nextKey));
  const [saved, setSaved] = useState(() => fingerprint(toDraft(notice, () => 0)));
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const user = usePanelUser();
  const { result, setResult, pending, run } = useAction();
  const dirty = fingerprint(draft) !== saved;

  const preview = useMemo<WeeklyNotice>(
    () => ({ ...draft, period: draft.period || currentWeek, updated_at: notice.updated_at }),
    [draft, currentWeek, notice.updated_at],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setResult(null);
  }

  function setPoints(change: (points: DraftPoint[]) => DraftPoint[]) {
    setDraft((current) => ({ ...current, points: change(current.points) }));
    setResult(null);
  }

  function updatePoint(key: number, patch: Partial<NoticePoint>) {
    setPoints((points) => points.map((point) => (point.key === key ? { ...point, ...patch } : point)));
  }

  function movePoint(index: number, step: -1 | 1) {
    setPoints((points) => {
      const target = index + step;
      if (target < 0 || target >= points.length) return points;
      const next = [...points];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removePoint(point: DraftPoint, index: number) {
    if ((point.title.trim() || point.text.trim()) && !window.confirm(`¿Quitar el punto ${index + 1}${point.title ? ` «${point.title}»` : ""}?`)) return;
    setPoints((points) => points.filter((item) => item.key !== point.key));
  }

  function addPoint() {
    if (draft.points.length >= maxPoints) return;
    const key = nextKey();
    setPoints((points) => [...points, { key, title: "", text: "" }]);
    window.requestAnimationFrame(() => document.getElementById(`point-title-${key}`)?.focus());
  }

  function restoreExample() {
    if (!window.confirm("Se reemplazará el contenido actual por las indicaciones de ejemplo. Podrás editarlas antes de guardar.")) return;
    setDraft(toDraft({ ...defaults, enabled: draft.enabled }, nextKey));
    setResult(null);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const snapshot = fingerprint(draft);
    run(
      () =>
        send("/admin/indicaciones", {
          enabled: draft.enabled ? "1" : "0",
          kicker: draft.kicker,
          title: draft.title,
          period: draft.period,
          intro: draft.intro,
          closing: draft.closing,
          points: JSON.stringify(draft.points.map(({ title, text }) => ({ title, text }))),
        }),
      () => setSaved(snapshot),
    );
  }

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Página web"
          title="Indicaciones de la semana"
          text="Este aviso aparece como ventana emergente apenas alguien entra a la página de acceso. Solo se cierra con la ✕, así nadie lo pasa por alto."
          aside={
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ${notice.enabled ? "bg-emerald-50 text-emerald-800" : "bg-white text-muted ring-1 ring-line"}`}>
                <span className={`h-2 w-2 rounded-full ${notice.enabled ? "bg-emerald-500" : "bg-muted/50"}`} />
                {notice.enabled ? "Publicadas" : "Ocultas"}
              </span>
              <a href="/acceso?vista=indicaciones" target="_blank" rel="noreferrer" className={ghost}>
                Ver en /acceso <span aria-hidden="true">↗</span>
              </a>
            </div>
          }
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted">
          <p>{lastEdit(notice)}</p>
          {user.superadmin && (
            <p>
              Lo editan las cuentas con la función «Indicaciones de la semana».{" "}
              <Link href="/admin/equipo" className="font-semibold text-ink underline-offset-4 hover:underline">Asignar en Equipo y accesos →</Link>
            </p>
          )}
        </div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <form onSubmit={save} className="min-w-0 space-y-6">
            <Panel
              title="Visibilidad"
              text="Cuando está activa, la ventana se muestra cada vez que se abre /acceso, en computadora y en celular."
              actions={
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.enabled}
                  onClick={() => set("enabled", !draft.enabled)}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${draft.enabled ? "bg-emerald-500" : "bg-line"}`}
                >
                  <span className="sr-only">Mostrar indicaciones</span>
                  <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${draft.enabled ? "translate-x-7" : "translate-x-1"}`} />
                </button>
              }
            >
              <p className="text-sm font-semibold">{draft.enabled ? "Se mostrará al ingresar a /acceso" : "No se mostrará a nadie"}</p>
            </Panel>

            <Panel title="Encabezado" text="Lo primero que leen al abrir la ventana.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-muted">
                  Etiqueta superior
                  <input value={draft.kicker} onChange={(event) => set("kicker", event.target.value)} maxLength={60} placeholder="Indicaciones de la semana" className={input} />
                </label>
                <label className="block text-xs font-semibold text-muted">
                  Vigencia
                  <input value={draft.period} onChange={(event) => set("period", event.target.value)} maxLength={90} placeholder={currentWeek} className={input} />
                  <span className="mt-1.5 block text-[11px] font-normal">Si lo dejas vacío se muestra la semana actual automáticamente.</span>
                </label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-muted">
                Título
                <input value={draft.title} onChange={(event) => set("title", event.target.value)} maxLength={120} required placeholder="Antes de reunirte con tu grupo" className={input} />
              </label>
              <label className="mt-4 block text-xs font-semibold text-muted">
                Mensaje de introducción <span className="font-normal">(opcional)</span>
                <textarea value={draft.intro} onChange={(event) => set("intro", event.target.value)} maxLength={600} rows={3} className={input} placeholder="Un saludo breve para los servidores." />
              </label>
            </Panel>

            <Panel
              title="Puntos de la semana"
              text={`${draft.points.length} de ${maxPoints} puntos. Usa las flechas para cambiar el orden.`}
              actions={<button type="button" onClick={restoreExample} className={ghost}>Restaurar ejemplo</button>}
            >
              <ol className="space-y-3">
                {draft.points.map((point, index) => (
                  <li key={point.key} className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[12px] tracking-normal text-white">{index + 1}</span>
                        Punto {index + 1}
                      </p>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => movePoint(index, -1)} disabled={index === 0} aria-label={`Subir punto ${index + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink disabled:opacity-30">
                          <ArrowIcon up />
                        </button>
                        <button type="button" onClick={() => movePoint(index, 1)} disabled={index === draft.points.length - 1} aria-label={`Bajar punto ${index + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink disabled:opacity-30">
                          <ArrowIcon />
                        </button>
                        <button type="button" onClick={() => removePoint(point, index)} aria-label={`Quitar punto ${index + 1}`} className="ml-1 rounded-full px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50">
                          Quitar
                        </button>
                      </div>
                    </div>
                    <input
                      id={`point-title-${point.key}`}
                      value={point.title}
                      onChange={(event) => updatePoint(point.key, { title: event.target.value })}
                      maxLength={120}
                      placeholder="Título del punto"
                      aria-label={`Título del punto ${index + 1}`}
                      className={`${input} font-semibold`}
                    />
                    <textarea
                      value={point.text}
                      onChange={(event) => updatePoint(point.key, { text: event.target.value })}
                      maxLength={700}
                      rows={2}
                      placeholder="Detalle (opcional)"
                      aria-label={`Detalle del punto ${index + 1}`}
                      className={input}
                    />
                  </li>
                ))}
              </ol>
              {!draft.points.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Agrega al menos un punto para publicar las indicaciones.</p>}
              <button
                type="button"
                onClick={addPoint}
                disabled={draft.points.length >= maxPoints}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-white/60 px-4 py-3.5 text-sm font-semibold transition hover:border-ink/40 hover:bg-white disabled:opacity-40"
              >
                <span className="text-lg leading-none">+</span> Agregar punto
              </button>
            </Panel>

            <Panel title="Firma" text="Aparece al pie de la ventana.">
              <input value={draft.closing} onChange={(event) => set("closing", event.target.value)} maxLength={120} placeholder="Equipo pastoral · Iglesia Cristiana Zoe" className={`${input} mt-0`} />
            </Panel>

            <div className="sticky bottom-3 z-10 space-y-3 rounded-[1.4rem] border border-line bg-card/95 p-3 shadow-[0_18px_40px_-24px_rgba(42,39,36,0.45)] backdrop-blur">
              <Notice result={result} onClose={() => setResult(null)} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="px-2 text-xs font-semibold text-muted">{dirty ? "Tienes cambios sin guardar" : "Todo guardado"}</p>
                <button disabled={pending || !draft.points.length} className={button}>
                  {pending ? "Guardando…" : draft.enabled ? "Guardar y publicar" : "Guardar"}
                </button>
              </div>
            </div>
          </form>

          <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <Panel
              title="Vista previa"
              text="Así lo verán al entrar a /acceso."
              actions={
                <div className="flex rounded-full bg-paper p-1">
                  {(["mobile", "desktop"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDevice(item)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${device === item ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                    >
                      {item === "mobile" ? "Celular" : "Computadora"}
                    </button>
                  ))}
                </div>
              }
            >
              <div className={`flex justify-center overflow-hidden rounded-[1.4rem] bg-[rgba(22,18,14,0.56)] ${device === "mobile" ? "items-end px-4 pt-10" : "items-center p-6"}`}>
                <div className={`flex w-full flex-col ${device === "mobile" ? "h-[600px] max-w-[360px] justify-end" : "max-h-[640px] max-w-[38rem]"}`}>
                  <NoticeCard
                    notice={preview}
                    onClose={() => undefined}
                    className={device === "mobile" ? "max-h-full rounded-t-[1.5rem]" : "rounded-[1.5rem] shadow-[0_30px_70px_-30px_rgba(20,16,12,0.7)]"}
                  />
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import SiteLayout from "@/Layouts/SiteLayout";
import { section } from "@/lib/design";

export const primary = "btn-accent inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const ghost = "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-5 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-50";
export const field = "w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-ink/40";

/** Frame of every game screen: the site layout, a way back and the page title. */
export function GamePage({
  kicker,
  title,
  text,
  back,
  children,
  aside,
}: {
  kicker: string;
  title: string;
  text?: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <header {...section("intro", "Portada")} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              {back ? (
                <Link href={back.href} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink">
                  <span aria-hidden>←</span> {back.label}
                </Link>
              ) : null}
              <p className="kicker">{kicker}</p>
              <LeadTitle text={title} className="mt-4 text-5xl md:text-7xl" />
              {text ? <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{text}</p> : null}
            </div>
            {aside}
          </header>
        </Rise>
        {children}
      </article>
    </SiteLayout>
  );
}

export function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${
        active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink hover:border-ink/30"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      {hint ? <p className="mt-1 text-sm leading-6 text-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export type OptionState = "idle" | "picked" | "right" | "wrong" | "faded";

/** One answer of a question; after grading it turns green when right and brick when wrong. */
export function OptionButton({ label, text, state, onClick, disabled }: { label: string; text: string; state: OptionState; onClick: () => void; disabled?: boolean }) {
  const tone = {
    idle: "border-line bg-card hover:-translate-y-0.5 hover:border-ink/30",
    picked: "border-ink bg-card ring-4 ring-ink/10",
    right: "border-emerald-600 bg-emerald-50 text-emerald-950",
    wrong: "border-accent bg-accent-soft text-ink",
    faded: "border-line bg-card opacity-45",
  }[state];
  const badge = {
    idle: "bg-sage text-ink",
    picked: "bg-ink text-paper",
    right: "bg-emerald-600 text-white",
    wrong: "bg-accent text-white",
    faded: "bg-sage text-muted",
  }[state];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left text-[15.5px] font-medium leading-6 transition duration-200 disabled:cursor-default md:px-5 ${tone}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${badge}`}>{state === "right" ? "✓" : state === "wrong" ? "✕" : label}</span>
      <span>{text}</span>
    </button>
  );
}

export function Meter({ value, total, className = "" }: { value: number; total: number; className?: string }) {
  const percent = total ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-sage ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Seconds left as a ring that empties; it turns brick in the last five seconds. */
export function Countdown({ left, total }: { left: number; total: number }) {
  const radius = 26;
  const length = 2 * Math.PI * radius;
  const ratio = total ? Math.max(0, left) / total : 0;
  const urgent = left <= 5;
  return (
    <div className="relative grid h-16 w-16 place-items-center" aria-label={`${Math.ceil(left)} segundos`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--sage)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={urgent ? "var(--accent)" : "var(--ink)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span className={`text-lg font-semibold tabular-nums ${urgent ? "text-accent" : "text-ink"}`}>{Math.max(0, Math.ceil(left))}</span>
    </div>
  );
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" | "ok" }) {
  const style = { error: "bg-accent-soft text-ink", info: "bg-sage text-ink", ok: "bg-emerald-50 text-emerald-900" }[tone];
  return <p className={`rounded-2xl px-4 py-3 text-sm leading-6 ${style}`}>{children}</p>;
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-ink">{value}</p>
    </div>
  );
}

export function Scoreboard({ rows, me, total }: { rows: { id: string; name: string; score: number; correct: number; answered?: number; done?: boolean }[]; me?: string; total?: number }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-[1.4rem] border border-line bg-card">
      {rows.map((row, index) => (
        <li key={row.id} className={`flex items-center gap-4 px-4 py-3.5 md:px-5 ${row.id === me ? "bg-accent-soft" : ""}`}>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${index === 0 ? "bg-accent text-white" : "bg-sage text-ink"}`}>{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">
              {row.name}
              {row.id === me ? <span className="ml-2 text-xs font-medium text-muted">(tú)</span> : null}
            </span>
            <span className="text-xs text-muted">
              {row.correct} correctas
              {total ? ` · ${row.done ? "terminó" : `${row.answered ?? 0} de ${total}`}` : ""}
            </span>
          </span>
          <span className="text-lg font-semibold tabular-nums text-ink">{row.score.toLocaleString("es-PE")}</span>
        </li>
      ))}
    </ol>
  );
}

/** Small drawn emblems of each game, in the colors of the active skin. */
export function GameEmblem({ game, className = "h-12 w-12" }: { game: "rebet" | "lingobible" | "oculto"; className?: string }) {
  if (game === "rebet") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden>
        <circle cx="24" cy="26" r="17" fill="var(--accent-soft)" stroke="var(--ink)" strokeWidth="2.5" />
        <path d="M24 26V15" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 26l7 5" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M19 5h10M24 5v4" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (game === "lingobible") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden>
        <path d="M6 11c6-2 12-2 18 2v26c-6-4-12-4-18-2z" fill="var(--accent-soft)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M42 11c-6-2-12-2-18 2v26c6-4 12-4 18-2z" fill="var(--card)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M29 20l3 3 6-6" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M6 20c0-6 8-10 18-10s18 4 18 10c0 9-8 16-18 16S6 29 6 20z" fill="var(--accent-soft)" stroke="var(--ink)" strokeWidth="2.5" />
      <ellipse cx="17" cy="21" rx="4" ry="3" fill="var(--ink)" />
      <ellipse cx="31" cy="21" rx="4" ry="3" fill="var(--ink)" />
      <path d="M20 30c2.5 1.5 5.5 1.5 8 0" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

import { Link } from "@inertiajs/react";
import { useEffect, useRef } from "react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import SiteLayout from "@/Layouts/SiteLayout";
import { section } from "@/lib/design";
import "../../../css/games.css";

export const primary =
  "btn-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold shadow-[0_14px_28px_-16px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
export const ghost =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-card px-5 text-[15px] font-semibold text-ink transition hover:border-ink/30 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50";
export const onDark =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-[15px] font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50";
export const field =
  "min-h-12 w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-accent/60 focus:ring-4 focus:ring-accent/10";
export const darkField =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/40 focus:border-white/50 focus:ring-4 focus:ring-white/10";

/**
 * Frame of every game screen. Menus open with the large title; screens of a game in
 * progress use the compact bar so the table gets the room on a phone.
 */
export function GamePage({
  kicker,
  title,
  text,
  back,
  children,
  aside,
  compact = false,
}: {
  kicker: string;
  title: string;
  text?: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
  aside?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <SiteLayout>
      <article className="page-wrap">
        {compact ? (
          <header {...section("intro", "Portada")} className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              {back ? (
                <Link href={back.href} aria-label={`Volver a ${back.label}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card text-ink transition hover:border-ink/30">
                  <ArrowLeft />
                </Link>
              ) : null}
              <div className="min-w-0">
                <p className="game-label truncate">{kicker}</p>
                <h1 className="editorial mt-1 truncate text-2xl md:text-[2rem]">{title}</h1>
              </div>
            </div>
            {aside}
          </header>
        ) : (
          <Rise>
            <header {...section("intro", "Portada")} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                {back ? (
                  <Link href={back.href} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink">
                    <ArrowLeft /> {back.label}
                  </Link>
                ) : null}
                <p className="kicker">{kicker}</p>
                <LeadTitle text={title} className="mt-4 text-5xl md:text-7xl" />
                {text ? <p className="mt-5 max-w-xl text-lg font-light leading-8 text-muted">{text}</p> : null}
              </div>
              {aside}
            </header>
          </Rise>
        )}
        {children}
      </article>
    </SiteLayout>
  );
}

/** Opens each new screen of a game from the top; otherwise a phone stays scrolled at the bottom of the last one. */
export function useScreenTop(screen: string | number) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);
}

export function Chip({ active, onClick, children, disabled, count }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-ink bg-ink text-paper shadow-[0_10px_20px_-14px_rgba(0,0,0,0.6)]" : "border-line bg-card text-ink hover:border-ink/30"
      }`}
    >
      {children}
      {count !== undefined ? <span className={`text-xs tabular-nums ${active ? "text-paper/60" : "text-muted"}`}>{count}</span> : null}
    </button>
  );
}

/** A big selectable card for choices that deserve a sentence, like the level of a game. */
export function Choice({ active, onClick, title, text, meta }: { active: boolean; onClick: () => void; title: string; text: string; meta?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex h-full w-full flex-col rounded-[1.4rem] border p-5 text-left transition ${
        active ? "border-accent bg-accent-soft ring-4 ring-accent/10" : "border-line bg-card hover:border-ink/30"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${active ? "border-accent bg-accent text-white" : "border-line"}`}>{active ? <Check className="h-3.5 w-3.5" /> : null}</span>
      </span>
      <span className="mt-1.5 text-sm leading-6 text-muted">{text}</span>
      {meta ? <span className="mt-3 text-xs font-semibold text-accent">{meta}</span> : null}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="game-label">{label}</p>
      {hint ? <p className="mt-1.5 text-sm leading-6 text-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export type OptionState = "idle" | "picked" | "right" | "wrong" | "faded";

/** One answer of a question; after grading it turns green when right and brick when wrong. */
export function OptionButton({ label, text, state, onClick, disabled }: { label: string; text: string; state: OptionState; onClick: () => void; disabled?: boolean }) {
  const tone = {
    idle: "border-line bg-card hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_16px_30px_-22px_rgba(28,24,20,0.5)]",
    picked: "border-ink bg-card ring-4 ring-ink/10",
    right: "border-emerald-600 bg-emerald-50 text-emerald-950 ring-4 ring-emerald-600/10",
    wrong: "border-accent bg-accent-soft text-ink ring-4 ring-accent/10",
    faded: "border-line bg-card opacity-45",
  }[state];
  const badge = {
    idle: "bg-sage text-ink group-hover:bg-accent group-hover:text-white",
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
      className={`group flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left text-[15.5px] font-medium leading-6 text-ink transition duration-200 disabled:cursor-default md:px-5 ${tone}`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold transition ${badge}`}>{state === "right" ? "✓" : state === "wrong" ? "✕" : label}</span>
      <span>{text}</span>
    </button>
  );
}

export function Meter({ value, total, className = "", dark = false }: { value: number; total: number; className?: string; dark?: boolean }) {
  const percent = total ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-sage"} ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
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
    <div className="relative grid h-16 w-16 shrink-0 place-items-center" aria-label={`${Math.ceil(left)} segundos`}>
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
      <span className={`text-lg font-bold tabular-nums ${urgent ? "text-accent" : "text-ink"}`}>{Math.max(0, Math.ceil(left))}</span>
    </div>
  );
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" | "ok" }) {
  const style = { error: "border-accent/25 bg-accent-soft text-ink", info: "border-line bg-sage/70 text-ink", ok: "border-emerald-200 bg-emerald-50 text-emerald-900" }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${style}`}>
      {children}
    </p>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="game-label">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em] text-ink">{value}</p>
    </div>
  );
}

const toneOf = (name: string) => [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 6;

export function Avatar({ name, size = "md", className = "" }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const scale = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg", xl: "h-20 w-20 text-2xl" }[size];
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <span className={`game-avatar ${scale} ${className}`} data-tone={toneOf(name)} aria-hidden>
      {letters || "?"}
    </span>
  );
}

export function Scoreboard({ rows, me, total }: { rows: { id: string; name: string; score: number; correct: number; answered?: number; done?: boolean }[]; me?: string; total?: number }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-[1.4rem] border border-line bg-card">
      {rows.map((row, index) => (
        <li key={row.id} className={`flex items-center gap-3 px-4 py-3 md:px-5 ${row.id === me ? "bg-accent-soft" : ""}`}>
          <span className={`w-6 text-center text-sm font-bold tabular-nums ${index === 0 ? "text-accent" : "text-muted"}`}>{index + 1}</span>
          <Avatar name={row.name} size="sm" />
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
          <span className="text-lg font-bold tabular-nums text-ink">{row.score.toLocaleString("es-PE")}</span>
        </li>
      ))}
    </ol>
  );
}

/** One way to play a game, as a card on its menu. */
export function ModeCard({ title, text, tags, onClick, icon, delay = 0 }: { title: string; text: string; tags: string[]; onClick: () => void; icon: React.ReactNode; delay?: number }) {
  return (
    <Rise delay={delay} className="h-full">
      <button type="button" onClick={onClick} className="game-surface game-lift group flex h-full w-full flex-col p-6 text-left md:p-7">
        <span className="flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink transition group-hover:border-accent group-hover:bg-accent group-hover:text-white">
            <ArrowRight />
          </span>
        </span>
        <span className="editorial mt-6 text-[1.7rem] leading-tight">{title}</span>
        <span className="mt-2 text-[15px] leading-7 text-muted">{text}</span>
        <span className="mt-auto flex flex-wrap gap-1.5 pt-6">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-sage/80 px-2.5 py-1 text-xs font-medium text-ink/80">
              {tag}
            </span>
          ))}
        </span>
      </button>
    </Rise>
  );
}

export function Steps({ items, title = "Cómo se juega" }: { items: [string, string][]; title?: string }) {
  return (
    <Rise className="mt-16">
      <p className="kicker">{title}</p>
      <ol className={`mt-6 grid gap-3 sm:grid-cols-2 ${items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {items.map(([name, text], index) => (
          <li key={name} className="relative rounded-[1.4rem] border border-line bg-card p-5">
            <span className="editorial text-4xl text-accent/25">{String(index + 1).padStart(2, "0")}</span>
            <p className="mt-2 font-semibold text-ink">{name}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </Rise>
  );
}

/** The two ways out of a finished game: back to the same room, or leave. */
export function EndActions({ onLobby, onExit, lobbyText, exitText, busy, lobbyLabel = "Volver a la sala", exitLabel = "Salir" }: { onLobby: () => void; onExit: () => void; lobbyText: string; exitText: string; busy?: boolean; lobbyLabel?: string; exitLabel?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" disabled={busy} onClick={onLobby} className="btn-accent group flex items-center gap-4 rounded-[1.4rem] p-5 text-left shadow-[0_18px_34px_-20px_var(--accent)] disabled:opacity-60">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15">
          <DoorIcon />
        </span>
        <span>
          <span className="block text-lg font-semibold">{lobbyLabel}</span>
          <span className="block text-sm text-white/80">{lobbyText}</span>
        </span>
      </button>
      <button type="button" disabled={busy} onClick={onExit} className="group flex items-center gap-4 rounded-[1.4rem] border border-line bg-card p-5 text-left transition hover:border-ink/30 disabled:opacity-60">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage text-ink">
          <ExitIcon />
        </span>
        <span>
          <span className="block text-lg font-semibold text-ink">{exitLabel}</span>
          <span className="block text-sm text-muted">{exitText}</span>
        </span>
      </button>
    </div>
  );
}

export function Waiting({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[15px] ${dark ? "text-white/70" : "text-muted"}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      {children}
    </p>
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

export function ArrowLeft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 10H4M9 5l-5 5 5 5" />
    </svg>
  );
}

export function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

export function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export function PhoneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

export function GroupIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14c2.4.2 4 1.7 4.5 4.5" />
    </svg>
  );
}

export function UserIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h16M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15" />
      <circle cx="14.5" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4" />
    </svg>
  );
}

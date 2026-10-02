import { Head, Link, router } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useSitePalette } from "@/Components/site/palette-scope";
import { send, type ActionResult } from "@/lib/actions";
import { classLine, formatClassTime, formatStudyDate, plural, scheduleLabel, type StudyLevel, type StudyNotice, type StudyReading, type StudyVerse } from "@/lib/studies";
import "../../../css/classroom.css";

type RouteStep = { id: string; name: string; summary: string | null; state: "done" | "current" | "next"; average: number | null };
type Grade = { id: string; title: string; week: number | null; score: number | null };
type Summary = { average: number | null; graded: number; total: number; pass_score: number; max_score: number };
type Student = { name: string; first_name: string; username: string; status: string; status_label: string };

type Props = {
  student: Student;
  level: StudyLevel | null;
  route: RouteStep[];
  grades: Grade[];
  summary: Summary;
  verses: StudyVerse[];
  notices: StudyNotice[];
  readings: StudyReading[];
  today: string;
};

const toneLabel: Record<StudyNotice["tone"], string> = { aviso: "Aviso", importante: "Importante", celebracion: "Celebración" };

function useStored(key: string): [string[], (next: string[]) => void] {
  const [value, setValue] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });
  const save = useCallback(
    (next: string[]) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next.slice(-200)));
      } catch {
        // Private mode: the list only lives for this visit.
      }
    },
    [key],
  );
  return [value, save];
}

function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

export default function MiRuta(props: Props) {
  const { student, level, route, grades, summary, verses, notices, readings } = props;
  const { style, attrs } = useSitePalette();
  const [seen, setSeen] = useStored(`zoe-aula-avisos-${student.username}`);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [reading, setReading] = useState<StudyReading | null>(null);
  const unseen = notices.filter((notice) => !seen.includes(notice.id));
  const [toasts, setToasts] = useState<StudyNotice[]>([]);
  const [arrival] = useState(() => unseen.slice(0, 2));

  useEffect(() => {
    if (!arrival.length) return;
    const show = window.setTimeout(() => setToasts(arrival), 700);
    const hide = window.setTimeout(() => setToasts([]), 9700);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [arrival]);

  const markSeen = (ids: string[]) => setSeen([...new Set([...seen, ...ids])]);
  const closeToast = (notice: StudyNotice) => {
    setToasts((list) => list.filter((item) => item.id !== notice.id));
    markSeen([notice.id]);
  };
  const goToNotices = () => {
    setToasts([]);
    setBellOpen(false);
    document.getElementById("avisos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => markSeen(notices.map((notice) => notice.id)), 1800);
  };

  return (
    <div data-skin="aire" {...attrs} className="aula min-h-screen bg-paper text-ink" style={style as CSSProperties}>
      <Head title={`Mi aula · ${level?.name ?? "La Ruta del Servidor"}`} />

      <header className="aula-top">
        <div className="aula-wrap flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="text-[1.15rem] font-semibold tracking-[-0.03em]">Iglesia Zoe</span>
            <span className="hidden rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white sm:inline">Aula</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setBellOpen((open) => !open);
                  setMenuOpen(false);
                }}
                className="aula-icon-btn"
                aria-label={unseen.length ? `Avisos, ${unseen.length} sin leer` : "Avisos"}
                aria-expanded={bellOpen}
              >
                <BellIcon />
                {unseen.length ? <span className="aula-badge">{unseen.length > 9 ? "9+" : unseen.length}</span> : null}
              </button>
              {bellOpen ? (
                <div className="aula-pop right-0 w-[min(22rem,calc(100vw-2rem))]">
                  <div className="flex items-center justify-between px-4 pb-2 pt-3">
                    <p className="text-sm font-semibold">Avisos</p>
                    {unseen.length ? (
                      <button type="button" onClick={() => markSeen(notices.map((notice) => notice.id))} className="text-xs font-semibold text-muted hover:text-ink">
                        Marcar como leídos
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto px-2 pb-2">
                    {notices.length ? (
                      notices.slice(0, 8).map((notice) => (
                        <button key={notice.id} type="button" onClick={goToNotices} className="block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-sage">
                          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                            {!seen.includes(notice.id) ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                            <span className="truncate">{notice.title}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted">{notice.body}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted">No hay avisos por ahora.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setBellOpen(false);
                }}
                className="flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1 pl-1 pr-3 text-sm font-semibold transition hover:border-ink/25"
                aria-expanded={menuOpen}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[13px] text-white">{student.first_name.charAt(0).toUpperCase()}</span>
                <span className="hidden max-w-[9rem] truncate sm:inline">{student.first_name}</span>
              </button>
              {menuOpen ? (
                <div className="aula-pop right-0 w-60 p-2">
                  <p className="px-3 pb-2 pt-1.5 text-xs text-muted">
                    <span className="block truncate text-sm font-semibold text-ink">{student.name}</span>
                    {student.username} · {student.status_label}
                  </p>
                  <button type="button" onClick={() => { setPasswordOpen(true); setMenuOpen(false); }} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-sage">
                    Cambiar mi clave
                  </button>
                  <Link href="/ruta-del-servidor" className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sage">La Ruta del Servidor</Link>
                  <button type="button" onClick={() => router.post("/salir")} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50">
                    Salir
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="aula-wrap pb-20 pt-8 md:pt-12">
        <section className="aula-in grid gap-5 lg:grid-cols-[1.35fr_1fr]" style={{ "--d": 0 } as CSSProperties}>
          <Hero student={student} level={level} />
          <VerseCard verses={verses} username={student.username} today={props.today} />
        </section>

        <section className="aula-in mt-5 grid gap-5 lg:grid-cols-[1fr_1.35fr]" style={{ "--d": 1 } as CSSProperties}>
          <GradesCard grades={grades} summary={summary} level={level} />
          <RouteCard route={route} />
        </section>

        <section id="avisos" className="aula-in mt-12 scroll-mt-24" style={{ "--d": 2 } as CSSProperties}>
          <SectionTitle kicker="Notificaciones" title="Avisos de la iglesia" count={unseen.length ? `${unseen.length} sin leer` : undefined} />
          {notices.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {notices.map((notice) => (
                <article key={notice.id} className="aula-notice" data-tone={notice.tone}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="aula-tone">{toneLabel[notice.tone]}</span>
                    {!seen.includes(notice.id) ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">Nuevo</span> : null}
                    {notice.published_at ? <span className="ml-auto text-xs text-muted">{formatStudyDate(notice.published_at)}</span> : null}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-0.02em]">{notice.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-[14.5px] leading-6 text-muted">{notice.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty>Cuando la iglesia publique un aviso, aparecerá aquí y te avisaremos al entrar.</Empty>
          )}
        </section>

        <section className="aula-in mt-12" style={{ "--d": 3 } as CSSProperties}>
          <SectionTitle kicker="Material" title="Lecturas" count={readings.length ? plural(readings.length, "lectura", "lecturas") : undefined} />
          {readings.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {readings.map((item) => (
                <article key={item.id} className="aula-reading">
                  <div className="flex items-start gap-3">
                    <span className="aula-pdf">PDF</span>
                    <div className="min-w-0">
                      {item.week ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Semana {item.week}</p> : null}
                      <h3 className="mt-0.5 font-semibold leading-snug tracking-[-0.01em]">{item.title}</h3>
                      {item.summary ? <p className="mt-1 text-[13px] leading-5 text-muted">{item.summary}</p> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => (window.matchMedia("(min-width: 768px)").matches ? setReading(item) : window.open(item.file_url, "_blank", "noopener"))}
                      className="btn-accent flex-1 rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      Leer
                    </button>
                    <a href={item.file_url} target="_blank" rel="noreferrer" download className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold transition hover:border-ink/30">
                      Descargar
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty>Tu maestro subirá aquí las lecturas de cada semana.</Empty>
          )}
        </section>

        <p className="mt-16 text-center text-xs text-muted">Iglesia Cristiana Zoe · La Ruta del Servidor</p>
      </main>

      {toasts.length ? (
        <div className="aula-toasts" role="status" aria-live="polite">
          {toasts.map((notice, index) => (
            <div key={notice.id} className="aula-toast" data-tone={notice.tone} style={{ "--i": index } as CSSProperties}>
              <div className="flex items-start gap-3">
                <span className="aula-toast-icon"><BellIcon /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{toneLabel[notice.tone]}</p>
                  <p className="mt-0.5 font-semibold leading-snug">{notice.title}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">{notice.body}</p>
                  <button type="button" onClick={goToNotices} className="mt-2 text-[13px] font-semibold text-accent">Ver avisos →</button>
                </div>
                <button type="button" onClick={() => closeToast(notice)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-sage" aria-label="Cerrar aviso">×</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {reading ? <PdfViewer reading={reading} onClose={() => setReading(null)} /> : null}
      {passwordOpen ? <PasswordDialog onClose={() => setPasswordOpen(false)} /> : null}
      {bellOpen || menuOpen ? <button type="button" aria-label="Cerrar" className="fixed inset-0 z-30 cursor-default" onClick={() => { setBellOpen(false); setMenuOpen(false); }} /> : null}
    </div>
  );
}

function Hero({ student, level }: { student: Student; level: StudyLevel | null }) {
  const now = useNow();
  if (!level) {
    return (
      <div className="aula-hero">
        <p className="aula-kicker">La Ruta del Servidor</p>
        <h1 className="aula-title">Hola, {student.first_name}</h1>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-white/75">
          {student.status === "egresado"
            ? "¡Terminaste La Ruta del Servidor! Gracias por tu compromiso. Aquí siempre puedes revisar tus notas, avisos y lecturas."
            : "Aún no te han ubicado en un nivel. Tu maestro lo hará muy pronto y aquí verás tu semana, tu horario y tus notas."}
        </p>
      </div>
    );
  }
  const schedule = level.schedule;
  const next = schedule.next_class ? new Date(schedule.next_class) : null;

  return (
    <div className="aula-hero">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="aula-kicker">Estás en · {level.name}</p>
          <h1 className="aula-title">Hola, {student.first_name}</h1>
        </div>
        <Ring value={schedule.progress} label={schedule.state === "running" ? `${schedule.week}/${schedule.weeks}` : schedule.state === "finished" ? "✓" : "0"} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{scheduleLabel(schedule)}</p>
      <div className="aula-bar mt-4"><i style={{ width: `${Math.max(schedule.progress, schedule.state === "running" ? 4 : 0)}%` }} /></div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="aula-fact">
          <dt>Horario</dt>
          <dd>{classLine(schedule)}</dd>
        </div>
        <div className="aula-fact">
          <dt>{schedule.state === "upcoming" ? "Empieza" : "Terminas"}</dt>
          <dd>{schedule.state === "upcoming" ? formatStudyDate(schedule.starts_on, true) : schedule.ends_on ? formatStudyDate(schedule.ends_on, true) : "Por anunciar"}</dd>
        </div>
        <div className="aula-fact">
          <dt>Próxima clase</dt>
          <dd>{next ? countdown(next, now, schedule.class_time) : schedule.state === "finished" ? "Ciclo terminado" : "Por anunciar"}</dd>
        </div>
      </dl>
      {level.place || level.teacher ? (
        <p className="mt-4 text-[13px] text-white/65">
          {level.place ? `📍 ${level.place}` : ""}
          {level.place && level.teacher ? "  ·  " : ""}
          {level.teacher ? `Maestro(a): ${level.teacher}` : ""}
        </p>
      ) : null}
    </div>
  );
}

const LIMA = "America/Lima";

function limaDay(ms: number) {
  return Date.parse(new Date(ms).toLocaleDateString("en-CA", { timeZone: LIMA }));
}

function countdown(next: Date, now: number, classTime: string) {
  const time = formatClassTime(classTime);
  const left = next.getTime() - now;
  const days = Math.round((limaDay(next.getTime()) - limaDay(now)) / 86400000);
  if (left <= 0) return `Hoy · ${time}`;
  if (days <= 0) {
    const hours = Math.floor(left / 3600000);
    return `Hoy · ${time} (en ${hours >= 1 ? `${hours} h` : `${Math.max(1, Math.round(left / 60000))} min`})`;
  }
  if (days === 1) return `Mañana · ${time}`;
  const weekday = next.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "short", timeZone: LIMA });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${time} (en ${days} días)`;
}

function Ring({ value, label }: { value: number; label: string }) {
  const radius = 30;
  const length = 2 * Math.PI * radius;
  return (
    <div className="aula-ring" role="img" aria-label={`Avance del nivel: ${value}%`}>
      <svg viewBox="0 0 72 72" width="72" height="72">
        <circle cx="36" cy="36" r={radius} className="aula-ring-track" />
        <circle cx="36" cy="36" r={radius} className="aula-ring-value" style={{ strokeDasharray: length, strokeDashoffset: length * (1 - value / 100) }} />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function VerseCard({ verses, username, today }: { verses: StudyVerse[]; username: string; today: string }) {
  const start = useMemo(() => {
    const date = new Date(`${today}T12:00:00`);
    const day = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    return verses.length ? day % verses.length : 0;
  }, [today, verses.length]);
  const [index, setIndex] = useState(start);
  const [amen, setAmen] = useStored(`zoe-aula-amen-${username}`);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);
  const verse = verses[index % Math.max(verses.length, 1)];

  if (!verse) {
    return (
      <div className="aula-verse">
        <p className="aula-kicker text-ink/50">Palabra para hoy</p>
        <p className="mt-4 text-lg leading-8">Pronto encontrarás aquí versículos para animarte cada día.</p>
      </div>
    );
  }

  const said = amen.includes(verse.id);
  const text = verse.reference ? `“${verse.text}” — ${verse.reference}` : verse.text;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: `${text}\n\nIglesia Cristiana Zoe` });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The person closed the share sheet.
    }
  }

  return (
    <div className="aula-verse">
      <div className="flex items-center justify-between gap-3">
        <p className="aula-kicker text-ink/50">{verse.reference ? "Versículo para hoy" : "Palabra de ánimo"}</p>
        {verses.length > 1 ? <p className="text-xs tabular-nums text-muted">{(index % verses.length) + 1} / {verses.length}</p> : null}
      </div>
      <blockquote key={verse.id} className="aula-verse-text">
        {verse.text.split(/\s+/).map((word, position) => (
          <span key={position} style={{ "--w": position } as CSSProperties}>{word} </span>
        ))}
      </blockquote>
      {verse.reference ? <p key={`${verse.id}-ref`} className="aula-verse-ref">{verse.reference}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
        <button
          type="button"
          onClick={() => {
            if (!said) {
              setAmen([...amen, verse.id]);
              setBurst((value) => value + 1);
            }
          }}
          className="aula-amen"
          data-on={said || undefined}
          aria-pressed={said}
        >
          <span className="aula-amen-heart" key={burst}>♥</span>
          {said ? "Amén" : "Decir amén"}
        </button>
        {verses.length > 1 ? (
          <button type="button" onClick={() => setIndex((value) => (value + 1) % verses.length)} className="aula-chip">
            Otro versículo ↻
          </button>
        ) : null}
        <button type="button" onClick={share} className="aula-chip">{copied ? "¡Copiado!" : "Compartir"}</button>
      </div>
    </div>
  );
}

function GradesCard({ grades, summary, level }: { grades: Grade[]; summary: Summary; level: StudyLevel | null }) {
  const average = summary.average;
  const passing = average !== null && average >= summary.pass_score;
  return (
    <div className="aula-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="aula-kicker text-ink/50">Mis notas</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{level?.name ?? "Sin nivel"}</h2>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Promedio</p>
          <p className={`text-4xl font-semibold tabular-nums tracking-[-0.04em] ${average === null ? "text-ink/30" : passing ? "text-emerald-700" : "text-red-700"}`}>
            {average === null ? "—" : average.toFixed(1)}
          </p>
        </div>
      </div>
      {grades.length ? (
        <>
          <ul className="mt-5 grid gap-3">
            {grades.map((grade, index) => (
              <li key={grade.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {grade.title}
                    {grade.week ? <span className="ml-1.5 text-xs text-muted">Semana {grade.week}</span> : null}
                  </span>
                  <span className={`font-semibold tabular-nums ${grade.score === null ? "text-muted" : grade.score >= summary.pass_score ? "" : "text-red-700"}`}>
                    {grade.score === null ? "Pendiente" : grade.score.toFixed(grade.score % 1 ? 1 : 0)}
                  </span>
                </div>
                <div className="aula-score mt-1.5">
                  <i
                    data-low={grade.score !== null && grade.score < summary.pass_score ? true : undefined}
                    style={{ width: `${grade.score === null ? 0 : (grade.score / summary.max_score) * 100}%`, "--n": index } as CSSProperties}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-2xl bg-paper px-4 py-3 text-[13px] leading-5 text-muted">
            {summary.graded === 0
              ? `Tus notas aparecerán aquí apenas tu maestro las registre. Apruebas con ${summary.pass_score}.`
              : passing
                ? `¡Vas muy bien! Llevas ${summary.graded} de ${summary.total} notas y apruebas con ${summary.pass_score}.`
                : `Llevas ${summary.graded} de ${summary.total} notas. Apruebas con ${summary.pass_score}: ¡tú puedes, sigue adelante!`}
          </p>
        </>
      ) : (
        <Empty>Tus notas aparecerán aquí apenas tu maestro las registre.</Empty>
      )}
    </div>
  );
}

function RouteCard({ route }: { route: RouteStep[] }) {
  return (
    <div className="aula-card">
      <p className="aula-kicker text-ink/50">Mi ruta</p>
      <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">La Ruta del Servidor</h2>
      <ol className="aula-route mt-5">
        {route.map((step, index) => (
          <li key={step.id} data-state={step.state}>
            <span className="aula-route-node">{step.state === "done" ? "✓" : index + 1}</span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold tracking-[-0.01em]">
                {step.name}
                {step.state === "current" ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">Aquí estás</span> : null}
                {step.state === "done" && step.average !== null ? <span className="text-xs font-medium text-muted">Promedio {step.average.toFixed(1)}</span> : null}
              </p>
              {step.summary ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{step.summary}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SectionTitle({ kicker, title, count }: { kicker: string; title: string; count?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="aula-kicker text-ink/50">{kicker}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{title}</h2>
      </div>
      {count ? <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-muted shadow-sm">{count}</span> : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 rounded-[1.4rem] border border-dashed border-ink/15 px-5 py-6 text-center text-sm leading-6 text-muted">{children}</p>;
}

function PdfViewer({ reading, onClose }: { reading: StudyReading; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="aula-modal" role="dialog" aria-modal="true" aria-label={reading.title}>
      <button type="button" className="aula-modal-scrim" aria-label="Cerrar" onClick={onClose} />
      <div className="aula-viewer">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <p className="min-w-0 truncate font-semibold">{reading.title}</p>
          <div className="flex shrink-0 gap-2">
            <a href={reading.file_url} target="_blank" rel="noreferrer" className="rounded-full border border-ink/10 px-3 py-1.5 text-sm font-semibold hover:border-ink/30">Abrir aparte ↗</a>
            <button type="button" onClick={onClose} className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-white">Cerrar</button>
          </div>
        </div>
        <iframe src={reading.file_url} title={reading.title} className="h-full w-full flex-1 bg-white" />
      </div>
    </div>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const field = "mt-1.5 w-full rounded-xl border border-ink/12 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-ink/40";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const next = await send("/estudios/clave", new FormData(event.currentTarget));
    setPending(false);
    setResult(next);
  }

  return (
    <div className="aula-modal" role="dialog" aria-modal="true" aria-label="Cambiar mi clave">
      <button type="button" className="aula-modal-scrim" aria-label="Cerrar" onClick={onClose} />
      <form onSubmit={submit} className="aula-dialog">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Cambiar mi clave</h2>
        <p className="mt-1 text-sm text-muted">Usa al menos 6 caracteres que puedas recordar.</p>
        <label className="mt-4 block text-sm font-medium">Clave actual<input name="current" type="password" required autoComplete="current-password" className={field} /></label>
        <label className="mt-3 block text-sm font-medium">Nueva clave<input name="password" type="password" required minLength={6} autoComplete="new-password" className={field} /></label>
        <label className="mt-3 block text-sm font-medium">Repite la nueva clave<input name="confirm" type="password" required minLength={6} autoComplete="new-password" className={field} /></label>
        {result?.error || result?.message ? (
          <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${result.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{result.error || result.message}</p>
        ) : null}
        <div className="mt-5 flex gap-2">
          {result?.ok ? (
            <button type="button" onClick={onClose} className="btn-accent rounded-full px-5 py-2.5 text-sm font-semibold">Listo</button>
          ) : (
            <>
              <button disabled={pending} className="btn-accent rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{pending ? "Guardando…" : "Guardar clave"}</button>
              <button type="button" onClick={onClose} className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold">Cancelar</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

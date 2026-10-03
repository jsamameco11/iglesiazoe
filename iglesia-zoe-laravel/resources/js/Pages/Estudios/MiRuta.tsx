import { Head, Link, router } from "@inertiajs/react";
import { useEffect, useState, type CSSProperties } from "react";
import { useSiteDesign } from "@/lib/design";
import { formatStudyDate, plural, type StudyLevel, type StudyNotice, type StudyReading, type StudyVerse } from "@/lib/studies";
import type { RouteStep, Grade, Summary, Student } from "@/Components/classroom/types";
import { useStored } from "@/Components/classroom/hooks";
import { Hero } from "@/Components/classroom/hero";
import { VerseCard, GradesCard, RouteCard, SectionTitle, Empty } from "@/Components/classroom/cards";
import { PdfViewer, PasswordDialog } from "@/Components/classroom/dialogs";
import { BellIcon } from "@/Components/ui/icons";
import "../../../css/classroom.css";

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

export default function MiRuta(props: Props) {
  const { student, level, route, grades, summary, verses, notices, readings } = props;
  const { style, attrs } = useSiteDesign();
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
                <BellIcon className="h-[19px] w-[19px]" />
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
                <span className="aula-toast-icon"><BellIcon className="h-[19px] w-[19px]" /></span>
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


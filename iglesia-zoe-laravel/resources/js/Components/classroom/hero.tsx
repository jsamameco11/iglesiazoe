import { classLine, formatClassTime, formatStudyDate, scheduleLabel, type StudyLevel } from "@/lib/studies";
import type { Student } from "./types";
import { useNow } from "./hooks";
import { useSitePages } from "@/lib/site-pages";
import { LIMA, limaDate } from "@/lib/dates";

export function Hero({ student, level }: { student: Student; level: StudyLevel | null }) {
  const now = useNow();
  const routeName = useSitePages().name("route");
  if (!level) {
    return (
      <div className="aula-hero">
        <p className="aula-kicker">{routeName}</p>
        <h1 className="aula-title">Hola, {student.first_name}</h1>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-white/75">
          {student.status === "egresado"
            ? `¡Terminaste ${routeName}! Gracias por tu compromiso. Aquí siempre puedes revisar tus notas, avisos y lecturas.`
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

function limaDay(ms: number) {
  return Date.parse(limaDate(ms));
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

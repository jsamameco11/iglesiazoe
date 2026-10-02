export type StudySchedule = {
  state: "pending" | "upcoming" | "running" | "finished";
  week: number | null;
  weeks: number;
  starts_on: string | null;
  ends_on: string | null;
  class_time: string;
  day: string | null;
  progress: number;
  next_class: string | null;
};

export type StudyLevel = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  place: string | null;
  teacher: string | null;
  pass_score: number;
  sort_order: number;
  active: boolean;
  schedule: StudySchedule;
};

export type StudyVerse = { id: string; level_id: string | null; reference: string | null; text: string; active: boolean };

export type StudyNotice = {
  id: string;
  level_id: string | null;
  title: string;
  body: string;
  tone: "aviso" | "importante" | "celebracion";
  starts_on: string | null;
  ends_on: string | null;
  published_at: string | null;
  active: boolean;
};

export type StudyReading = { id: string; level_id: string | null; title: string; summary: string | null; week: number | null; file_url: string; active: boolean };

export type LevelOption = { id: string; name: string };

/** "09:00" → "9:00 a. m." */
export function formatClassTime(value: string | null | undefined) {
  const [h, m] = (value || "09:00").split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

export function formatStudyDate(value: string | null | undefined, withYear = false) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}) });
}

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Day and time of the classes, e.g. "Sábados · 9:00 a. m." */
export function classLine(schedule: StudySchedule) {
  const time = formatClassTime(schedule.class_time);
  if (!schedule.day) return time;
  const day = schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1);
  return `${day}${day.endsWith("s") ? "" : "s"} · ${time}`;
}

export function scheduleLabel(schedule: StudySchedule) {
  switch (schedule.state) {
    case "running":
      return `Semana ${schedule.week} de ${schedule.weeks}`;
    case "upcoming":
      return `Inicia el ${formatStudyDate(schedule.starts_on)}`;
    case "finished":
      return "Ciclo terminado";
    default:
      return "Fecha de inicio por anunciar";
  }
}

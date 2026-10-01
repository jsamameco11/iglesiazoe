const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

export type WeekOption = {
  week: number;
  start: string;
  end: string;
  label: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function format(date: Date) {
  return `${pad(date.getDate())} de ${MONTHS[date.getMonth()]}`;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Semana 1: domingo de la semana que contiene el 1 de enero. */
export function weekRange(year: number, week: number) {
  const jan1 = new Date(year, 0, 1);
  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function weeksOfYear(year: number): WeekOption[] {
  const weeks: WeekOption[] = [];
  for (let week = 1; week <= 54; week++) {
    const { start, end } = weekRange(year, week);
    if (end.getFullYear() < year) continue;
    if (start.getFullYear() > year) break;
    weeks.push({
      week,
      start: isoDate(start),
      end: isoDate(end),
      label: `Semana:${pad(week)} | ${format(start)} - ${format(end)}`,
    });
  }
  return weeks;
}

export function currentWeek(date = new Date()) {
  const year = date.getFullYear();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weeks = weeksOfYear(year);
  const match = weeks.find((week) => {
    const { start, end } = weekRange(year, week.week);
    return day >= start && day <= end;
  });
  return { year, week: match?.week ?? weeks.at(-1)?.week ?? 1 };
}

export function meetingDateInWeek(year: number, week: number, meetingDay: string | null) {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const index = meetingDay ? days.findIndex((day) => day.toLowerCase() === meetingDay.toLowerCase()) : 0;
  const { start } = weekRange(year, week);
  const date = new Date(start);
  if (index > 0) date.setDate(start.getDate() + index);
  return isoDate(date);
}

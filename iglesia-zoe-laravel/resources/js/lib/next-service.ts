export type NextService = {
  live: boolean;
  label: string;
  at: number;
};

function clockFromText(text: string, fallbackHour: number) {
  const raw = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/);
  if (!match) return { hour: fallbackHour, minute: 0 };
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] || "";
  if (meridiem.includes("p") && hour < 12) hour += 12;
  if (meridiem.includes("a") && hour === 12) hour = 0;
  return { hour, minute };
}

function limaParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const week: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(value("hour"));
  if (hour === 24) hour = 0;
  return {
    weekday: week[value("weekday")] ?? 0,
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour,
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
}

function limaStamp(year: number, month: number, day: number, hour: number, minute: number, second = 0) {
  return Date.UTC(year, month - 1, day, hour + 5, minute, second);
}

function occurrence(now: Date, weekday: number, hour: number, minute: number, label: string): NextService {
  const lima = limaParts(now);
  const windowMin = 120;
  const nowMin = lima.hour * 60 + lima.minute;
  const startMin = hour * 60 + minute;
  let addDays = (weekday - lima.weekday + 7) % 7;
  if (addDays === 0 && nowMin >= startMin && nowMin < startMin + windowMin) {
    return { live: true, label, at: limaStamp(lima.year, lima.month, lima.day, hour, minute) };
  }
  if (addDays === 0 && nowMin >= startMin + windowMin) addDays = 7;
  return {
    live: false,
    label,
    at: limaStamp(lima.year, lima.month, lima.day, hour, minute) + addDays * 86400000,
  };
}

export function nextService(sundayText: string, wednesdayText: string, now = new Date()): NextService {
  const sunday = occurrence(now, 0, clockFromText(sundayText, 10).hour, clockFromText(sundayText, 10).minute, "Domingo");
  const wednesday = occurrence(now, 3, clockFromText(wednesdayText, 20).hour, clockFromText(wednesdayText, 20).minute, "Miércoles");
  if (sunday.live) return sunday;
  if (wednesday.live) return wednesday;
  return sunday.at <= wednesday.at ? sunday : wednesday;
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${hours}h${pad(minutes)}m${pad(seconds)}s`;
}

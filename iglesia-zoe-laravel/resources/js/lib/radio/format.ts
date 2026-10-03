import { LIMA, limaDate } from "@/lib/dates";

export { limaDate };

/** Short name for tight spots (decks, pads): the title cut at a word boundary. */
export function shortTitle(title: string, max = 26) {
  const clean = title.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.55 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export function clock(ms: number, seconds = false) {
  return new Date(ms).toLocaleTimeString("es-PE", { timeZone: LIMA, hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined, hour12: false });
}

export function duration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function longDuration(seconds: number) {
  if (seconds > 0 && seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Calendar day of an episode, like «2 oct 2026». */
export function longDate(date: string) {
  return new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-PE", { timeZone: LIMA, day: "numeric", month: "short", year: "numeric" });
}

export const DAY_MS = 86400000;

/** UTC milliseconds of 00:00 of a Lima calendar day (Lima has no daylight saving). */
export function dayStart(date: string) {
  return Date.parse(`${date}T00:00:00-05:00`);
}

export function addDays(date: string, days: number) {
  return limaDate(dayStart(date) + days * DAY_MS + 12 * 3600000);
}

export function dayLabel(date: string, today?: string) {
  if (today && date === today) return "Hoy";
  const value = new Date(`${date}T12:00:00-05:00`);
  if (today) {
    const tomorrow = new Date(`${today}T12:00:00-05:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (limaDate(tomorrow.getTime()) === date) return "Mañana";
  }
  return value.toLocaleDateString("es-PE", { timeZone: LIMA, weekday: "short", day: "numeric", month: "short" });
}

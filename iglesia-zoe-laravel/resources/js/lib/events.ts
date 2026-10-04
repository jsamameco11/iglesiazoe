import { fold } from "@/lib/text";
import type { ChurchEvent } from "@/lib/types";

function day(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

/** "2026-10" for a date or ISO day. */
export function monthKey(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 7);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, by: number) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + by, 1, 12));
}

/** "Octubre" and "2026" for a month key. */
export function monthTitle(key: string) {
  const [year, month] = key.split("-").map(Number);
  const name = new Date(year, month - 1, 1, 12).toLocaleDateString("es-PE", { month: "long" });
  return { month: name.charAt(0).toUpperCase() + name.slice(1), year: String(year) };
}

/** "Septiembre 2026" for a past event's card. */
export function monthYearLabel(value: string) {
  const title = monthTitle(monthKey(value));
  return `${title.month} ${title.year}`;
}

/** Every ISO day an event covers, from its start to its close (one day when it has none). */
export function eventDays(event: Pick<ChurchEvent, "starts_on" | "ends_on">) {
  const days: string[] = [];
  const cursor = day(event.starts_on);
  const last = day(event.ends_on && event.ends_on > event.starts_on ? event.ends_on : event.starts_on);
  while (cursor <= last && days.length < 62) {
    days.push(`${monthKey(cursor)}-${String(cursor.getDate()).padStart(2, "0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Weeks of a month starting on Monday; null fills the days before the 1st and after the last. */
export function monthGrid(key: string) {
  const [year, month] = key.split("-").map(Number);
  const lead = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
  const total = new Date(year, month, 0, 12).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let date = 1; date <= total; date++) cells.push(`${key}-${String(date).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Downloads an all-day calendar entry (Google, Outlook, Apple) for the event; the time goes in its notes. */
export function downloadEventIcs(event: ChurchEvent, pageUrl: string) {
  const days = eventDays(event);
  const after = day(days[days.length - 1]);
  after.setDate(after.getDate() + 1);
  const compact = (value: string) => value.replace(/-/g, "");
  const end = `${monthKey(after)}-${String(after.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const notes = [event.time_label ? `Hora: ${event.time_label}` : "", event.summary ?? "", event.cta_url ?? pageUrl].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Iglesia Zoe//Eventos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@iglesiazoe`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(days[0])}`,
    `DTEND;VALUE=DATE:${compact(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    event.location ? `LOCATION:${icsText(event.location)}` : "",
    `DESCRIPTION:${icsText(notes)}`,
    `URL:${pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${fold(event.title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento"}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function eventBadge(startsOn: string) {
  const date = day(startsOn);
  return {
    day: date.toLocaleDateString("es-PE", { day: "numeric" }),
    month: date.toLocaleDateString("es-PE", { month: "short" }).replace(".", ""),
    weekday: date.toLocaleDateString("es-PE", { weekday: "long" }),
  };
}

/** "sábado 12 de octubre" or "12 al 14 de octubre" / "30 de octubre al 2 de noviembre". */
export function eventDateLabel(startsOn: string, endsOn?: string | null) {
  const start = day(startsOn);
  if (!endsOn || endsOn.slice(0, 10) === startsOn.slice(0, 10)) {
    return start.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  }
  const end = day(endsOn);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const from = sameMonth ? start.toLocaleDateString("es-PE", { day: "numeric" }) : start.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
  return `${from} al ${end.toLocaleDateString("es-PE", { day: "numeric", month: "long" })}`;
}

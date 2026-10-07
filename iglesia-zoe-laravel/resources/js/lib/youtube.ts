export function youtubeId(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const match =
    raw.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    raw.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    raw.match(/youtube(?:-nocookie)?\.com\/(?:embed|live|shorts|v)\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : "";
}

/** Length badge the way YouTube prints it: 1:13:31 or 45:10. */
export function videoClock(seconds: number | null | undefined) {
  if (!seconds || seconds < 1) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(Math.floor(seconds % 60)).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** "353 visualizaciones", "1,4 mil visualizaciones": rounded down, as YouTube counts. */
export function formatViews(views: number | null | undefined) {
  if (views == null) return "";
  if (views === 1) return "1 visualización";
  if (views < 1000) return `${views} visualizaciones`;
  const [size, unit] = views < 1_000_000 ? [1000, "mil"] : [1_000_000, "M"];
  const amount = views / size < 10 ? Math.floor((views / size) * 10) / 10 : Math.floor(views / size);
  return `${amount.toLocaleString("es", { maximumFractionDigits: 1 })} ${unit} visualizaciones`;
}

/** "hace 6 días", "hace 2 semanas", like the channel lists its videos. */
export function timeAgo(value: string | null | undefined, now = Date.now()) {
  if (!value) return "";
  const then = new Date(value.length === 10 ? `${value}T12:00:00` : value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
    [Infinity, "year"],
  ];
  const sizes: Record<string, number> = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
  const unit = steps.find(([limit]) => seconds < limit)?.[1] ?? "year";
  const amount = Math.max(1, Math.floor(seconds / sizes[unit]));
  return new Intl.RelativeTimeFormat("es", { numeric: "always" }).format(-amount, unit);
}

/** Exact date of a broadcast in Lima, like YouTube's description box. */
export function formatAired(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Lima" });
}

export function videoThumbnail(sermon: { youtube_id: string | null; thumbnail?: string | null }) {
  const video = youtubeId(sermon.youtube_id);
  return sermon.thumbnail || (video ? `https://i.ytimg.com/vi/${video}/hqdefault.jpg` : "");
}

export function formatSermonDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

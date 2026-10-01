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

export function formatSermonDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

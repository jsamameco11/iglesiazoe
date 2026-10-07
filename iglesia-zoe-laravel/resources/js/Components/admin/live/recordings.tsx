import { formatDuration } from "@/lib/live";
import type { Recording } from "./types";

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 || unit < 2 ? 0 : 1)} ${units[unit]}`;
}

/** "2 días 5 h" until the original file is deleted from Wasabi. */
export function timeLeft(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const seconds = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (seconds <= 0) return "";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days} ${days === 1 ? "día" : "días"}${hours ? ` ${hours} h` : ""}`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
}

const STATUS: Record<Recording["status"], { label: string; tone: string }> = {
  pending: { label: "En cola", tone: "bg-paper text-muted" },
  processing: { label: "Guardando en Wasabi…", tone: "bg-amber-50 text-amber-800" },
  ready: { label: "Lista", tone: "bg-emerald-50 text-emerald-800" },
  failed: { label: "Falló", tone: "bg-red-50 text-red-800" },
  expired: { label: "Vencida", tone: "bg-paper text-muted" },
};

/** Original recordings in full quality, downloadable for a few days to edit reels and clips. */
export function RecordingList({ recordings, now }: { recordings: Recording[]; now?: number }) {
  if (!recordings.length) return null;

  return (
    <ul className="grid gap-2">
      {recordings.map((recording) => {
        const status = STATUS[recording.status] ?? STATUS.pending;
        const left = recording.status === "ready" ? timeLeft(recording.expires_at, now) : "";
        return (
          <li key={recording.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {recordings.length > 1 ? `Parte ${recording.part} · ` : ""}
                {recording.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {[formatDuration(recording.duration), formatBytes(recording.size), left ? `se borra en ${left}` : ""].filter(Boolean).join(" · ")}
                {recording.error ? <span className="block text-red-700">{recording.error}</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
              {recording.download ? (
                <a href={recording.download} className="inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white">
                  Descargar ↓
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

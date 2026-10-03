import { Link, usePage } from "@inertiajs/react";
import type { ReactNode } from "react";
import { can, usePanelUser, type Permission, useSiteUrl } from "@/lib/access";
import { csrf, type ActionResult } from "@/lib/actions";
import { KIND_LABEL, type RadioKind } from "@/lib/radio";

const tabs: { href: string; label: string; needs: Permission }[] = [
  { href: "/admin/radio", label: "Consola en vivo", needs: "radio.console" },
  { href: "/admin/radio/programacion", label: "Programación", needs: "radio.schedule" },
  { href: "/admin/radio/biblioteca", label: "Biblioteca", needs: "radio.library" },
  { href: "/admin/radio/listas", label: "Listas", needs: "radio.library" },
  { href: "/admin/radio/episodios", label: "Episodios", needs: "radio.episodes" },
  { href: "/admin/radio/ajustes", label: "Ajustes", needs: "radio.settings" },
];

export function RadioHeader({ title, text, aside }: { title: string; text: string; aside?: ReactNode }) {
  const path = usePage().url.split("?")[0];
  const user = usePanelUser();
  const allowed = tabs.filter((tab) => can(user, tab.needs));
  const site = useSiteUrl();
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-deep">Radio Zoe · Estudio</p>
          <h1 className="mt-3 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.045em] md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aside}
          <a href={`${site}/radio`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:border-ink/30">
            Escuchar la radio ↗
          </a>
        </div>
      </div>
      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 [scrollbar-width:none]">
        {allowed.map((tab) => {
          const active = tab.href === "/admin/radio" ? path === tab.href : path.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const tone: Record<RadioKind, string> = {
  musica: "bg-emerald-100 text-emerald-800",
  anuncio: "bg-amber-100 text-amber-800",
  efecto: "bg-violet-100 text-violet-800",
  programa: "bg-blue-100 text-blue-800",
  vivo: "bg-red-100 text-red-700",
  relleno: "bg-emerald-50 text-emerald-700",
  automatica: "bg-teal-100 text-teal-800",
};

export function KindTag({ kind, label }: { kind: RadioKind; label?: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone[kind]}`}>{label ?? KIND_LABEL[kind]}</span>;
}

export const AUDIO_ACCEPT = ".mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.webm,.flac,audio/*";

export const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

/** Posts a form with files and reports the upload progress (0 to 1); audio files are large. */
export function postWithProgress(url: string, data: FormData, onProgress: (value: number) => void = () => undefined) {
  return new Promise<ActionResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("X-CSRF-TOKEN", csrf());
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => {
      let body: ActionResult = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status === 413) resolve({ error: "El archivo es demasiado grande para el servidor." });
      else if (xhr.status >= 400 && !body.error) resolve({ error: body.message ? String(body.message) : "No se pudo subir el archivo." });
      else resolve(body);
    };
    xhr.onerror = () => resolve({ error: "Se cortó la conexión mientras subía el archivo." });
    xhr.send(data);
  });
}

/** Reads the length of an audio file in the browser before uploading it. */
export function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        done(audio.duration);
        return;
      }
      audio.currentTime = 1e7;
      audio.ontimeupdate = () => {
        audio.ontimeupdate = null;
        done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
      };
    };
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

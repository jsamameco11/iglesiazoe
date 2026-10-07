import { useEffect, useState } from "react";
import { input } from "@/Components/admin/ui";
import type { Catalog, Playlist, VideoOptions } from "./types";

type Mode = "live" | "upload" | "defaults";

const PRIVACY_NOTES: Record<string, string> = {
  public: "Todos pueden verlo. Se mostrará en la web.",
  unlisted: "Solo con el enlace. Se mostrará en la web.",
  private: "Solo el canal. No se mostrará en la web.",
};

/** UTC instant from the server → value for a datetime-local input in Lima time (UTC−5, no DST). */
function toLimaInput(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 16);
}

/** Stored options ready for the form: scheduled times shown in Lima time. */
export function editableOptions(options: VideoOptions): VideoOptions {
  return { ...options, tags: [...options.tags], scheduled_at: toLimaInput(options.scheduled_at), publish_at: toLimaInput(options.publish_at) };
}

/** Adds the options to a form exactly as VideoOptions::fromInput expects them. */
export function appendOptions(formData: FormData, options: VideoOptions, mode: Mode) {
  formData.set("privacy", options.privacy);
  formData.set("category", options.category);
  formData.set("tags", options.tags.join(", "));
  formData.set("language", options.language);
  formData.set("playlist", options.playlist);
  formData.set("license", options.license);
  formData.set("kids", options.kids ? "1" : "0");
  formData.set("embeddable", options.embeddable ? "1" : "0");
  formData.set("notify", options.notify ? "1" : "0");
  formData.set("latency", options.latency);
  formData.set("dvr", options.dvr ? "1" : "0");
  if (mode === "live" && options.scheduled_at) formData.set("scheduled_at", options.scheduled_at);
  if (mode === "upload" && options.publish_at) formData.set("publish_at", options.publish_at);
}

/** Playlists of the connected channel, fetched once when the fields open. */
export function usePlaylists(enabled: boolean) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || playlists) return;
    let stopped = false;
    fetch("/admin/transmision/youtube/listas", { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } })
      .then((response) => response.json())
      .then((data: { playlists?: Playlist[]; error?: string }) => {
        if (stopped) return;
        setPlaylists(data.playlists ?? []);
        setError(data.error ?? "");
      })
      .catch(() => !stopped && setError("No se pudieron cargar las listas de reproducción."));
    return () => {
      stopped = true;
    };
  }, [enabled, playlists]);

  return { playlists, error };
}

function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (value: boolean) => void; label: string; note?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
      <span>
        <span className="font-medium">{label}</span>
        {note ? <span className="mt-0.5 block text-xs text-muted">{note}</span> : null}
      </span>
    </label>
  );
}

/**
 * The same choices YouTube Studio asks for before a video or a live stream goes out.
 * "live" adds latency, DVR and the scheduled time; "upload" adds the scheduled publication.
 */
export function VideoOptionsFields({
  catalog,
  value,
  onChange,
  mode,
  connected,
}: {
  catalog: Catalog;
  value: VideoOptions;
  onChange: (next: VideoOptions) => void;
  mode: Mode;
  connected: boolean;
}) {
  const { playlists, error } = usePlaylists(connected);
  const [tags, setTags] = useState(value.tags.join(", "));
  const set = <K extends keyof VideoOptions>(key: K, next: VideoOptions[K]) => onChange({ ...value, [key]: next });

  function commitTags(text: string) {
    setTags(text);
    set(
      "tags",
      text
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
  }

  return (
    <div className="grid gap-5">
      <fieldset>
        <legend className="text-xs font-semibold text-muted">Visibilidad en YouTube</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {catalog.privacy.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm transition ${value.privacy === option.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
            >
              <input type="radio" name={`privacy-${mode}`} value={option.value} checked={value.privacy === option.value} onChange={() => set("privacy", option.value as VideoOptions["privacy"])} className="sr-only" />
              <span className="font-semibold">{option.label}</span>
              <span className={`mt-0.5 block text-xs ${value.privacy === option.value ? "text-white/70" : "text-muted"}`}>{PRIVACY_NOTES[option.value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-muted">
          Lista de reproducción
          <select value={value.playlist} onChange={(event) => set("playlist", event.target.value)} className={input} disabled={!connected}>
            <option value="">Ninguna</option>
            {(playlists ?? []).map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.title}
              </option>
            ))}
            {value.playlist && playlists && !playlists.some((playlist) => playlist.id === value.playlist) ? <option value={value.playlist}>Lista guardada</option> : null}
          </select>
          {error ? <span className="mt-1 block font-normal text-red-700">{error}</span> : null}
          {connected && playlists === null ? <span className="mt-1 block font-normal">Cargando listas…</span> : null}
        </label>
        <label className="text-xs font-semibold text-muted">
          Categoría
          <select value={value.category} onChange={(event) => set("category", event.target.value)} className={input}>
            {catalog.categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted md:col-span-2">
          Etiquetas <span className="font-normal">(separadas por comas · {tags.length}/500)</span>
          <input value={tags} maxLength={500} onChange={(event) => commitTags(event.target.value)} placeholder="iglesia, prédica, Zoe, fe" className={input} />
        </label>
        <label className="text-xs font-semibold text-muted">
          Idioma del video
          <select value={value.language} onChange={(event) => set("language", event.target.value)} className={input}>
            {catalog.languages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Licencia
          <select value={value.license} onChange={(event) => set("license", event.target.value)} className={input}>
            {catalog.licenses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {mode !== "upload" ? (
          <label className="text-xs font-semibold text-muted">
            Latencia de la transmisión
            <select value={value.latency} onChange={(event) => set("latency", event.target.value)} className={input}>
              {catalog.latency.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {mode === "live" ? (
          <label className="text-xs font-semibold text-muted">
            Hora programada <span className="font-normal">(opcional · hora de Lima)</span>
            <input type="datetime-local" value={value.scheduled_at || ""} onChange={(event) => set("scheduled_at", event.target.value || null)} className={input} />
          </label>
        ) : null}
        {mode === "upload" ? (
          <label className="text-xs font-semibold text-muted">
            Programar publicación <span className="font-normal">(opcional · hora de Lima)</span>
            <input type="datetime-local" value={value.publish_at || ""} onChange={(event) => set("publish_at", event.target.value || null)} className={input} />
            <span className="mt-1 block font-normal">Se sube como privado y YouTube lo publica solo a esa hora.</span>
          </label>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-muted">Público</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm ${!value.kids ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            <input type="radio" name={`kids-${mode}`} checked={!value.kids} onChange={() => set("kids", false)} className="sr-only" />
            No, no es contenido creado para niños
          </label>
          <label className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm ${value.kids ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            <input type="radio" name={`kids-${mode}`} checked={value.kids} onChange={() => set("kids", true)} className="sr-only" />
            Sí, es contenido creado para niños
          </label>
        </div>
        <p className="mt-1.5 text-xs text-muted">YouTube lo exige por ley (COPPA). Si es para niños, se desactivan los comentarios y el chat.</p>
      </fieldset>

      <div className="grid gap-2 md:grid-cols-2">
        <Toggle checked={value.embeddable} onChange={(next) => set("embeddable", next)} label="Permitir insertar el video" note="Necesario para verlo dentro de la página web." />
        <Toggle checked={value.notify} onChange={(next) => set("notify", next)} label="Notificar a los suscriptores" />
        {mode !== "upload" ? <Toggle checked={value.dvr} onChange={(next) => set("dvr", next)} label="Permitir retroceder (DVR)" note="Quien llega tarde puede volver al inicio." /> : null}
      </div>
      {!value.embeddable ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Sin permitir la inserción, el video no podrá reproducirse dentro de la web.</p> : null}
    </div>
  );
}

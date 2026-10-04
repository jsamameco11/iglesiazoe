import { useState } from "react";
import { Notice, button, ghost, input, useAction } from "@/Components/admin/ui";
import { RadioHeader } from "@/Components/radio/admin-ui";
import { SpotifyIcon } from "@/Components/radio/icons";
import AdminLayout from "@/Layouts/AdminLayout";
import { useSiteUrl } from "@/lib/access";
import { send } from "@/lib/actions";
import type { RadioSpotifyPlaylistAdmin } from "@/lib/radio";
import "../../../../css/radio.css";

type Props = { playlists: RadioSpotifyPlaylistAdmin[] };

type Draft = { id: string | null; link: string; name: string; description: string; published: boolean; cover: string | null; embed: string | null };

const blank: Draft = { id: null, link: "", name: "", description: "", published: true, cover: null, embed: null };

function draftOf(playlist: RadioSpotifyPlaylistAdmin): Draft {
  return { id: playlist.id, link: playlist.url, name: playlist.name, description: playlist.description ?? "", published: playlist.published, cover: playlist.cover, embed: playlist.embed };
}

type Found = { ok?: boolean; error?: string; message?: string | null; name?: string | null; cover?: string | null; embed?: string };

/**
 * The church's Spotify playlists, the ones the admin can choose as the radio's automatic music.
 * Listeners never pick them: they hear the one on air. The name and cover come from Spotify itself.
 */
export default function Spotify({ playlists }: Props) {
  const [draft, setDraft] = useState<Draft>(() => (playlists[0] ? draftOf(playlists[0]) : blank));
  const [looking, setLooking] = useState(false);
  const [listening, setListening] = useState(false);
  const { result, setResult, pending, run } = useAction();
  const site = useSiteUrl();
  const saved = playlists.find((item) => item.id === draft.id);
  const cover = draft.cover ?? saved?.cover ?? null;
  const embed = draft.embed ?? saved?.embed ?? null;
  const changed =
    !saved || draft.link !== saved.url || draft.name !== saved.name || draft.description !== (saved.description ?? "") || draft.published !== saved.published;

  function edit(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function open(playlist: RadioSpotifyPlaylistAdmin | null) {
    if (changed && draft.link && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    setResult(null);
    setListening(false);
    setDraft(playlist ? draftOf(playlist) : blank);
  }

  async function lookup() {
    if (!draft.link.trim()) return;
    setLooking(true);
    setResult(null);
    const found = (await send("/admin/radio/spotify/buscar", { link: draft.link })) as Found;
    setLooking(false);
    if (found.error) {
      setResult({ error: found.error });
      return;
    }
    setListening(false);
    edit({ name: draft.name.trim() && draft.id ? draft.name : (found.name ?? draft.name), cover: found.cover ?? draft.cover, embed: found.embed ?? null });
    if (found.message) setResult({ message: found.message });
  }

  function save() {
    run(
      () => send("/admin/radio/spotify", { id: draft.id ?? "", link: draft.link, name: draft.name, description: draft.description, published: draft.published ? "1" : "0" }),
      (data) => {
        const id = (data as { id?: string }).id;
        if (id) edit({ id });
      },
    );
  }

  function remove() {
    if (!draft.id || !window.confirm(`¿Quitar «${draft.name}» de la radio? En Spotify la playlist sigue igual.`)) return;
    run(
      () => send("/admin/radio/spotify/eliminar", { id: draft.id ?? "" }),
      () => setDraft(blank),
    );
  }

  function reorder(index: number, by: number) {
    const ids = playlists.map((item) => item.id);
    const [item] = ids.splice(index, 1);
    ids.splice(Math.max(0, Math.min(ids.length, index + by)), 0, item);
    run(() => send("/admin/radio/spotify/orden", { ids }));
  }

  const available = playlists.filter((item) => item.published).length;

  return (
    <AdminLayout>
      <RadioHeader
        title="Spotify"
        text="Registra las playlists de Spotify que la radio puede sonar como música automática. Tú eliges cuál suena en la Consola o en Programación; el oyente solo escucha la que está al aire, en su orden, sin poder cambiar de canción."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="rounded-[1.6rem] border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Tus playlists</p>
              <button type="button" onClick={() => open(null)} className={`${ghost} !px-3 !py-1.5 text-xs`}>+ Agregar playlist</button>
            </div>
            {playlists.length ? (
              <ol className="mt-3 space-y-1.5">
                {playlists.map((item, index) => {
                  const active = item.id === draft.id;
                  return (
                    <li key={item.id} className={`flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 transition ${active ? "border-ink bg-white" : "border-transparent bg-white/60 hover:border-line"}`}>
                      <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <Cover src={item.cover} className="h-11 w-11 rounded-lg" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{item.name}</span>
                          <span className={`text-[11.5px] font-semibold ${item.published ? "text-emerald-700" : "text-muted"}`}>{item.published ? "Disponible" : "Desactivada"}</span>
                        </span>
                      </button>
                      <span className="flex flex-col">
                        <button type="button" disabled={pending || index === 0} onClick={() => reorder(index, -1)} className="px-1 text-[11px] text-muted hover:text-ink disabled:opacity-30" aria-label="Subir">▲</button>
                        <button type="button" disabled={pending || index === playlists.length - 1} onClick={() => reorder(index, 1)} className="px-1 text-[11px] text-muted hover:text-ink disabled:opacity-30" aria-label="Bajar">▼</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">Aún no hay playlists. Pega el enlace de la primera a la derecha.</p>
            )}
          </section>
          <p className="px-2 text-[12px] leading-5 text-muted">
            {available
              ? `${available} ${available === 1 ? "playlist disponible" : "playlists disponibles"} para la música automática, en este orden.`
              : "Las playlists disponibles se ofrecen para la música automática, en este orden."}{" "}
            <a href={`${site}/radio`} target="_blank" rel="noreferrer" className="font-semibold text-ink underline">Ver la radio ↗</a>
          </p>
          <p className="rounded-2xl bg-paper px-4 py-3 text-[12px] leading-5 text-muted">
            Spotify no permite retransmitir su música desde la radio, así que en la página de la radio suena en un reproductor de Spotify bloqueado: el oyente solo puede escuchar o detener. Con
            su cuenta de Spotify oye las canciones completas; sin cuenta, adelantos de 30 segundos.
          </p>
        </aside>

        <section className="min-w-0 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
          <label className="text-xs font-semibold text-muted" htmlFor="spotify-link">Enlace de la playlist en Spotify</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              id="spotify-link"
              value={draft.link}
              onChange={(event) => edit({ link: event.target.value })}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), void lookup())}
              placeholder="https://open.spotify.com/playlist/…"
              className={`${input} !mt-0 flex-1`}
              autoComplete="off"
            />
            <button type="button" disabled={looking || !draft.link.trim()} onClick={lookup} className={`${ghost} shrink-0`}>
              {looking ? "Buscando…" : "Buscar en Spotify"}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-4 text-muted">En Spotify: abre la playlist › ··· › Compartir › Copiar enlace de la playlist. Debe ser pública.</p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid content-start gap-4">
              <label className="text-xs font-semibold text-muted">
                Nombre que se muestra
                <input value={draft.name} onChange={(event) => edit({ name: event.target.value })} maxLength={80} placeholder="Se completa solo al buscar" className={input} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Descripción (opcional)
                <textarea
                  value={draft.description}
                  onChange={(event) => edit({ description: event.target.value })}
                  maxLength={240}
                  rows={3}
                  placeholder="Ej.: Las canciones que cantamos los domingos."
                  className={`${input} resize-none`}
                />
                <span className="mt-1 block text-right font-mono text-[10.5px] font-normal">{draft.description.length}/240</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                <input type="checkbox" checked={draft.published} onChange={(event) => edit({ published: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#1db954]" />
                <span>
                  <span className="block text-sm font-semibold">Disponible para la música automática</span>
                  <span className="block text-[12px] leading-4 text-muted">Desmárcalo para guardarla sin que aparezca al elegir la música en la Consola o en Programación.</span>
                </span>
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted">Vista previa</p>
              <div className="spotify-card mt-2">
                <Cover src={cover} className="aspect-square w-full rounded-xl" />
                <p className="mt-3 truncate text-[15px] font-semibold text-white">{draft.name || "Nombre de la playlist"}</p>
                <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-[12.5px] leading-5 text-white/60">{draft.description || "Playlist de Spotify"}</p>
                {embed ? (
                  listening ? (
                    <iframe title={`Escuchar ${draft.name}`} src={embed} className="mt-3 h-[152px] w-full rounded-xl border-0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
                  ) : (
                    <button type="button" onClick={() => setListening(true)} className="spotify-open mt-3 w-full justify-center">
                      <SpotifyIcon className="h-4 w-4" /> Probar el reproductor
                    </button>
                  )
                ) : (
                  <p className="mt-3 text-[11.5px] text-white/45">Busca la playlist para ver su carátula.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <Notice result={result} onClose={() => setResult(null)} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" disabled={pending || !draft.link.trim() || (!changed && Boolean(cover))} onClick={save} className={button}>
                {pending ? "Guardando…" : draft.id ? "Guardar cambios" : "Agregar playlist"}
              </button>
              {draft.id ? (
                <a href={draft.link} target="_blank" rel="noreferrer" className={ghost}>Abrir en Spotify ↗</a>
              ) : null}
              {draft.id ? (
                <button type="button" disabled={pending} onClick={remove} className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                  Quitar playlist
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function Cover({ src, className = "" }: { src: string | null; className?: string }) {
  return src ? (
    <img src={src} alt="" className={`shrink-0 object-cover ${className}`} loading="lazy" />
  ) : (
    <span className={`grid shrink-0 place-items-center bg-[#1db954]/15 text-[#1db954] ${className}`}>
      <SpotifyIcon className="h-1/2 max-h-10 w-1/2 max-w-10" />
    </span>
  );
}

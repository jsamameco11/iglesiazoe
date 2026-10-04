import { router } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { SpotifyIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import type { RadioPlaylist, RadioSpotifyPlaylist } from "@/lib/radio";

function Cover({ item, size }: { item: RadioSpotifyPlaylist; size: string }) {
  return item.cover ? (
    <img src={item.cover} alt="" className={`${size} shrink-0 rounded object-cover`} loading="lazy" />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded bg-[#1db954]/15 text-[#1db954]`}>
      <SpotifyIcon className="h-3/5 w-3/5" />
    </span>
  );
}

/**
 * The Spotify playlist a list of the library takes as its reference, beside the list picker: a
 * chip with its cover, and a panel to preview it in Spotify's player and to change it. Only the
 * panel hears it; on air the library list plays.
 */
export function SpotifyReference({ list, references, studio = false }: { list: RadioPlaylist; references: RadioSpotifyPlaylist[]; studio?: boolean }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [picked, setPicked] = useState<{ list: string; id: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ list: string; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const chosen = picked?.list === list.id ? picked.id : (list.spotify?.id ?? null);
  const current = references.find((item) => item.id === chosen) ?? null;
  const problem = error?.list === list.id ? error.text : "";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function pick(id: string | null) {
    if (id === chosen) return;
    const target = list.id;
    setPicked({ list: target, id });
    setBusy(true);
    setError(null);
    const result = await send("/admin/radio/listas/referencia", { playlist: target, spotify: id ?? "" });
    setBusy(false);
    if (result.error) {
      setPicked(null);
      setError({ list: target, text: result.error });
      return;
    }
    router.reload({ only: ["playlists"], onFinish: () => setPicked(null) });
  }

  const chip = studio
    ? "flex h-[1.75rem] max-w-[15rem] items-center gap-1.5 rounded-[0.4rem] border border-[#1db954]/35 bg-[#1db954]/10 pl-1 pr-2 text-[0.7rem] font-semibold text-white transition hover:bg-[#1db954]/20"
    : "flex max-w-full items-center gap-2 rounded-xl border border-line bg-white py-1.5 pl-1.5 pr-3 text-[12.5px] font-semibold text-ink transition hover:border-[#1db954]";
  const empty = studio
    ? "flex h-[1.75rem] items-center gap-1.5 rounded-[0.4rem] border border-dashed border-white/20 px-2 text-[0.66rem] font-semibold text-white/55 transition hover:border-[#1db954]/60 hover:text-white"
    : "flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:border-[#1db954] hover:text-ink";
  const panel = studio
    ? "border-white/10 bg-[#17181b] text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)]"
    : "border-line bg-white text-ink shadow-[0_24px_60px_-20px_rgba(20,20,20,0.35)]";
  const muted = studio ? "text-white/45" : "text-muted";
  const row = (on: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition disabled:opacity-50 ${
      on ? (studio ? "bg-[#1db954]/15 text-white" : "bg-[#1db954]/10 text-ink") : studio ? "text-white/80 hover:bg-white/5" : "hover:bg-paper"
    }`;

  return (
    <div ref={box} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          const left = box.current?.getBoundingClientRect().left ?? 0;
          setAlignRight(left + 384 > window.innerWidth);
          setOpen((value) => !value);
        }}
        aria-expanded={open} className={current ? chip : empty} title="Referencia de Spotify para esta lista (solo en el panel)">
        {current ? (
          <>
            <Cover item={current} size={studio ? "h-5 w-5" : "h-7 w-7"} />
            <span className="min-w-0 truncate">{current.name}</span>
            <SpotifyIcon className="h-3.5 w-3.5 shrink-0 text-[#1db954]" />
          </>
        ) : (
          <>
            <SpotifyIcon className="h-3.5 w-3.5 shrink-0 text-[#1db954]" />
            <span>Referencia de Spotify</span>
          </>
        )}
      </button>

      {open ? (
        <div role="dialog" aria-label={`Referencia de Spotify para «${list.name}»`} className={`absolute ${alignRight ? "right-0" : "left-0"} top-full z-50 mt-2 w-[23rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-3 ${panel}`}>
          <div className="flex items-start gap-2">
            <SpotifyIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#1db954]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-5">Referencia para «{list.name}»</p>
              <p className={`text-[11.5px] leading-4 ${muted}`}>Solo se escucha aquí en el panel. Al aire suena la lista «{list.name}» de la Biblioteca.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className={`-mr-1 -mt-1 rounded-md px-1.5 text-lg leading-none ${muted} hover:opacity-80`} aria-label="Cerrar">
              ×
            </button>
          </div>

          {current ? (
            <iframe
              key={current.id}
              title={`Vista previa de ${current.name} en Spotify`}
              src={current.embed}
              className="mt-3 block h-[152px] w-full rounded-xl border-0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : null}

          {references.length ? (
            <div className="mt-3">
              <p className={`mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] ${muted}`}>Tus playlists de Spotify</p>
              <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
                {references.map((item) => (
                  <li key={item.id}>
                    <button type="button" disabled={busy} onClick={() => pick(item.id)} className={row(item.id === chosen)} aria-pressed={item.id === chosen}>
                      <Cover item={item} size="h-8 w-8" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.name}</span>
                        {item.description ? <span className={`block truncate text-[11px] ${muted}`}>{item.description}</span> : null}
                      </span>
                      {item.id === chosen ? <span className="shrink-0 text-[11px] font-bold text-[#1db954]">Elegida</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={`mt-3 rounded-xl border border-dashed px-3 py-4 text-center text-[12px] leading-5 ${studio ? "border-white/15 text-white/55" : "border-line text-muted"}`}>
              Aún no guardas playlists de Spotify en el panel.
            </p>
          )}

          {problem ? <p className="mt-2 text-[11.5px] font-medium text-red-500">{problem}</p> : null}

          <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-[11.5px] font-semibold ${studio ? "border-white/10" : "border-line"}`}>
            {current ? (
              <a href={current.url} target="_blank" rel="noreferrer" className="text-[#1db954] hover:underline">
                Abrir en Spotify ↗
              </a>
            ) : null}
            {current ? (
              <button type="button" disabled={busy} onClick={() => pick(null)} className={`${muted} hover:underline disabled:opacity-50`}>
                Quitar referencia
              </button>
            ) : null}
            <a href="/admin/radio/spotify" className={`ml-auto ${muted} hover:underline`}>
              {references.length ? "Administrar playlists" : "+ Agregar playlists de Spotify"}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

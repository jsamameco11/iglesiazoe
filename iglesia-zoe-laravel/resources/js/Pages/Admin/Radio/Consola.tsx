import { useState } from "react";
import { RadioHeader } from "@/Components/radio/admin-ui";
import { Decks } from "@/Components/radio/console/decks";
import { LivePanel } from "@/Components/radio/console/live-panel";
import { LiveTimeline } from "@/Components/radio/console/live-timeline";
import { Mixer } from "@/Components/radio/console/mixer";
import { PadBank, addPad } from "@/Components/radio/console/pad-bank";
import { SoundBrowser } from "@/Components/radio/console/sound-browser";
import { SwitchPanel } from "@/Components/radio/console/switch-panel";
import { LaunchNow, TodayList } from "@/Components/radio/console/today";
import { useConsole, type Snapshot } from "@/Components/radio/console/use-console";
import { HeadphonesIcon, MicIcon, UsersIcon } from "@/Components/radio/icons";
import AdminLayout from "@/Layouts/AdminLayout";
import { KIND_LABEL, clock, duration, shortTitle, type RadioBlock, type RadioPlaylist, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Props = Snapshot & {
  pads: RadioTrack[];
  library: RadioTrack[];
  today: string;
  day: RadioBlock[];
  host: string;
  playlists: RadioPlaylist[];
};

export default function Consola({ radio, live, voice, config, autopilot, pads: initialPads, library, day, host, playlists }: Props) {
  const api = useConsole({ radio, live, voice, config, autopilot }, host);
  const { notice, setNotice, now, state } = api;
  const [pads, setPads] = useState(initialPads);
  const session = api.live.session;
  const caster = api.caster.current;
  const current = state.queue.find((item) => item.start <= now && now < item.end) ?? null;
  const next = state.queue.find((item) => item.start > now) ?? null;
  const rotating = current && !current.slot && current.track ? current.track : null;

  async function onPad(track: RadioTrack) {
    const result = await addPad(pads, track);
    if (result.pads) setPads(result.pads);
    setNotice(result.error ? { tone: "error", text: result.error } : { tone: "info", text: `«${track.title}» agregado a la botonera.` });
  }

  return (
    <AdminLayout>
      <RadioHeader title="Consola en vivo" text="Arrastra sonidos a la línea de tiempo, los fondos o la botonera. Todo suena al instante para los oyentes, con sus empalmes." />

      {notice ? (
        <div className={`mt-4 flex items-start justify-between gap-4 rounded-xl px-3 py-2 text-[13px] ${notice.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} className="opacity-60" aria-label="Cerrar aviso">×</button>
        </div>
      ) : null}

      <div className="studio cx mt-4">
        <div className="cx-bar">
          <span className="studio-onair" data-on={session || state.live.cut ? "" : undefined}>
            <span className="h-2 w-2 rounded-full bg-current" /> {state.live.cut ? "En vivo" : session ? "On air" : "Piloto automático"}
          </span>
          {session ? <span className="cx-stat font-mono tabular-nums text-white">{api.live.started_at ? duration((now - api.live.started_at) / 1000) : "0:00"}</span> : null}
          <span className="cx-stat font-mono tabular-nums" title="Hora de Lima">{clock(now, true)}</span>
          <span className="cx-stat min-w-0 flex-1" title={current?.title}>
            <span className="cx-stat-key">Ahora</span>
            <span className="truncate text-white/90">{current ? shortTitle(current.title, 60) : "—"}</span>
            {current ? <span className="shrink-0 font-mono tabular-nums text-emerald-300">-{duration((current.end - now) / 1000)}</span> : null}
          </span>
          {rotating && current ? (
            <button type="button" onClick={() => api.dropFromRotation(rotating, current.title)} className="cx-btn" data-tone="amber" title="Saca esta canción de la música continua: deja de sonar ahora y no se repite">
              No repetir
            </button>
          ) : null}
          <span className="cx-stat hidden min-w-0 lg:inline-flex" title={next?.title}>
            <span className="cx-stat-key">Sigue</span>
            <span className="max-w-[14rem] truncate text-white/70">{next ? `${KIND_LABEL[next.kind] ?? ""} · ${next.title}` : "—"}</span>
            {next ? <span className="shrink-0 font-mono tabular-nums text-white/45">en {duration((next.start - now) / 1000)}</span> : null}
          </span>
          <span className="cx-stat"><UsersIcon className="h-3.5 w-3.5" /> {state.listeners}</span>
          {session ? (
            <span className="cx-stat" title="Oyentes con la voz conectada">
              <MicIcon className="h-3.5 w-3.5" /> {api.voice}
              {caster?.connected !== api.voice ? <span className="text-white/40">({caster?.connected ?? 0})</span> : null}
            </span>
          ) : null}
          <button type="button" onClick={api.toggleMonitor} className="cx-btn" data-tone={api.monitor ? "green" : undefined} title="Escuchar lo que oyen los oyentes">
            <HeadphonesIcon className="h-3.5 w-3.5" /> {api.monitor ? "Monitor" : "Escuchar"}
          </button>
          <button
            type="button"
            onClick={api.toggleAutofill}
            className="cx-btn"
            data-tone={api.config.autofill ? "green" : undefined}
            title={api.config.autofill ? "La música continua llena los espacios sin programación. Clic para pausarla." : "La música continua está en pausa. Clic para reanudarla."}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${api.config.autofill ? "bg-emerald-300" : "bg-white/40"}`} />
            {api.config.autofill ? "Música continua" : "Música continua en pausa"}
          </button>
          <button type="button" onClick={api.toggleAir} className="cx-btn" data-tone={api.config.on_air ? "green" : undefined}>
            <span className={`h-1.5 w-1.5 rounded-full ${api.config.on_air ? "bg-emerald-300" : "bg-white/40"}`} />
            {api.config.on_air ? "Radio al aire" : "Fuera del aire"}
          </button>
        </div>

        <SwitchPanel api={api} day={day} playlists={playlists} />

        <div className="mt-2 grid gap-2 xl:grid-cols-[16rem_minmax(0,1fr)]">
          <SoundBrowser api={api} library={library} onPad={onPad} />
          <LiveTimeline api={api} library={library} />
        </div>

        <div className="mt-2 grid gap-2 2xl:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)]">
          <Mixer api={api} />
          <Decks api={api} library={library} />
          <div className="xl:col-span-2 2xl:col-span-1">
            <PadBank api={api} pads={pads} setPads={setPads} library={library} onAdd={onPad} />
          </div>
        </div>

        <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <LivePanel api={api} />
          <LaunchNow api={api} library={library} />
          <TodayList day={day} now={now} autofill={api.config.autofill} />
        </div>
      </div>
    </AdminLayout>
  );
}

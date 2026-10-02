import { RadioHeader } from "@/Components/radio/admin-ui";
import { LivePanel } from "@/Components/radio/console/live-panel";
import { Mixer } from "@/Components/radio/console/mixer";
import { MusicDeck } from "@/Components/radio/console/music-deck";
import { PadBank } from "@/Components/radio/console/pad-bank";
import { Players } from "@/Components/radio/console/players";
import { LaunchNow, TodayList } from "@/Components/radio/console/today";
import { useConsole, type Snapshot } from "@/Components/radio/console/use-console";
import { MicIcon, UsersIcon } from "@/Components/radio/icons";
import AdminLayout from "@/Layouts/AdminLayout";
import { duration, type RadioBlock, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Props = Snapshot & {
  pads: RadioTrack[];
  library: RadioTrack[];
  today: string;
  day: RadioBlock[];
  host: string;
};

export default function Consola({ radio, live, voice, config, pads, library, day, host }: Props) {
  const api = useConsole({ radio, live, voice, config }, host);
  const { notice, setNotice, now, state } = api;
  const session = api.live.session;
  const caster = api.caster.current;

  return (
    <AdminLayout>
      <RadioHeader
        title="Consola en vivo"
        text="Tu estudio: sal al aire con tu voz, mezcla la música de fondo, dispara efectos y anuncios desde la botonera y suena hasta tres audios a la vez encima del programa. La programación sigue sola, a la hora exacta, aunque nadie esté en la consola."
      />

      {notice ? (
        <div className={`mt-6 flex items-start justify-between gap-4 rounded-2xl px-4 py-3 text-sm ${notice.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} className="opacity-60" aria-label="Cerrar aviso">×</button>
        </div>
      ) : null}

      <div className="studio mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="studio-onair" data-on={session ? "" : undefined}>
            <span className="h-2 w-2 rounded-full bg-current" /> {session ? "En vivo" : "Sin locutor"}
          </span>
          {session ? <span className="font-mono text-lg tabular-nums text-white/90">{api.live.started_at ? duration((now - api.live.started_at) / 1000) : "0:00"}</span> : null}
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70">
            <UsersIcon /> {state.listeners} oyentes
          </span>
          {session ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70">
              <MicIcon className="h-4 w-4" /> Voz conectada con {api.voice}
              {caster?.connected !== api.voice ? <span className="text-white/40">({caster?.connected ?? 0} aquí)</span> : null}
            </span>
          ) : null}
          <button
            type="button"
            onClick={api.toggleAir}
            className={`ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${api.config.on_air ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30" : "bg-white/10 text-white/60 hover:bg-white/15"}`}
          >
            <span className={`h-2 w-2 rounded-full ${api.config.on_air ? "bg-emerald-400" : "bg-white/40"}`} />
            {api.config.on_air ? "Radio al aire" : "Radio fuera del aire"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <MusicDeck api={api} />
          <LivePanel api={api} />
        </div>

        <div className="mt-4 grid gap-4 2xl:grid-cols-[auto_1fr]">
          <Mixer api={api} />
          <PadBank api={api} initial={pads} library={library} />
        </div>

        <div className="mt-4">
          <Players api={api} library={library} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.45fr]">
          <LaunchNow api={api} library={library} />
          <TodayList day={day} now={now} autofill={api.config.autofill} />
        </div>
      </div>
    </AdminLayout>
  );
}

import { useState, type FormEvent, type ReactNode } from "react";
import { RadioHeader } from "@/Components/radio/admin-ui";
import { Notice, Panel, button, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send } from "@/lib/actions";
import type { RadioConfig } from "@/lib/radio";
import "../../../../css/radio.css";

function Toggle({ name, defaultChecked, title, text }: { name: string; defaultChecked: boolean; title: string; text: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-ink/25">
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-5 text-muted">{text}</span>
      </span>
    </label>
  );
}

function Slider({
  name,
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  hint,
  unit = "%",
  display,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  hint: string;
  unit?: string;
  display?: (value: number) => string;
}) {
  return (
    <label className="block text-xs font-semibold text-muted">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-ink">{display ? display(value) : `${value}${unit}`}</span>
      </span>
      <input type="range" name={name} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--color-accent)]" />
      <span className="mt-1 block font-normal leading-5">{hint}</span>
    </label>
  );
}

export default function Ajustes({ config }: { config: RadioConfig }) {
  const { result, setResult, pending, run } = useAction();
  const [bed, setBed] = useState(config.bed_level);
  const [fx, setFx] = useState(config.fx_level);
  const [duck, setDuck] = useState(config.duck_level);
  const [crossfade, setCrossfade] = useState(config.crossfade);
  const [liveMode, setLiveMode] = useState(config.live_mode);
  const [liveSource, setLiveSource] = useState(config.live_source);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(() => send("/admin/radio/ajustes", data));
  }

  return (
    <AdminLayout>
      <RadioHeader title="Ajustes de la radio" text="Nombre de la emisora, comportamiento de la programación, niveles de la mezcla y opciones avanzadas de transmisión." />

      <form onSubmit={submit} className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Emisora" text="Así aparece la radio en la página pública.">
          <div className="grid gap-4">
            <label className="text-xs font-semibold text-muted">
              Nombre de la radio
              <input name="name" defaultValue={config.name} required minLength={2} maxLength={60} className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Lema
              <input name="tagline" defaultValue={config.tagline} maxLength={160} className={input} />
            </label>
            <Toggle name="on_air" defaultChecked={config.on_air} title="Radio al aire" text="Si lo apagas, la página muestra «Fuera del aire» y no suena nada. Al abrir una transmisión en vivo se enciende sola." />
            <Toggle
              name="show_titles"
              defaultChecked={config.show_titles}
              title="Mostrar la canción que suena"
              text="Los oyentes ven el nombre y el artista de cada canción en el reproductor, en «A continuación» y en la programación. Si lo apagas, solo ven que suena música en vivo; los programas, anuncios y el locutor se siguen mostrando."
            />
            <Toggle
              name="autofill"
              defaultChecked={config.autofill}
              title="Piloto automático (música 24/7)"
              text="Los espacios libres de la pista principal se llenan con la música automática: la lista que elijas en Programación o en la consola (o todas tus listas y las canciones marcadas «Se repite»), empalmadas y sin repetir hasta completar cada vuelta. Si lo apagas, esos espacios quedan en silencio."
            />
          </div>
        </Panel>

        <Panel title="En vivo" text="Cómo la música automática le da paso al locutor y cómo vuelve." className="xl:col-span-2">
          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-xs font-semibold text-muted">Interruptor</legend>
              <input type="hidden" name="live_mode" value={liveMode} />
              {(
                [
                  ["auto", "Automático", "A la hora de un bloque en vivo, en cuanto el locutor se conecta la música se corta sola; al terminar el bloque (o si se desconecta) la música vuelve sola. Si nadie se conecta, sigue la música."],
                  ["manual", "Manual", "La música solo se corta con «Cortar música · ir al vivo» y vuelve con «Volver a la música automática», desde la consola."],
                ] as const
              ).map(([value, title, text]) => (
                <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${liveMode === value ? "border-ink bg-white" : "border-line bg-white hover:border-ink/25"}`}>
                  <input type="radio" checked={liveMode === value} onChange={() => setLiveMode(value)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-5 text-muted">{text}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="grid content-start gap-2">
              <legend className="mb-1 text-xs font-semibold text-muted">¿Desde dónde sale el vivo?</legend>
              <input type="hidden" name="live_source" value={liveSource} />
              {(
                [
                  ["consola", "Consola de este panel", "El locutor habla desde «Consola en vivo» con su micrófono; su voz llega directo a cada oyente."],
                  ["externo", "OBS o plataforma de radio", "El locutor transmite con OBS, BUTT, Mixxx o su plataforma (Icecast, Shoutcast, Zeno.fm, Radio.co…). La web detecta la señal y la reproduce mientras dure el vivo."],
                ] as const
              ).map(([value, title, text]) => (
                <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${liveSource === value ? "border-ink bg-white" : "border-line bg-white hover:border-ink/25"}`}>
                  <input type="radio" checked={liveSource === value} onChange={() => setLiveSource(value)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-5 text-muted">{text}</span>
                  </span>
                </label>
              ))}
              {liveSource === "externo" ? (
                <label className="mt-1 text-xs font-semibold text-muted">
                  Enlace de la señal en vivo (https://…)
                  <input name="live_url" type="url" required defaultValue={config.live_url} maxLength={300} placeholder="https://stream.ejemplo.com/vivo" className={input} />
                  <span className="mt-1 block font-normal leading-5">
                    El «mount» de tu servidor: cuando OBS transmite responde y la música se corta; cuando deja de transmitir, la música vuelve. Debe ser https para que los navegadores lo reproduzcan.
                  </span>
                </label>
              ) : (
                <input type="hidden" name="live_url" value={config.live_url} />
              )}
            </fieldset>
          </div>
        </Panel>

        <Panel title="Mezcla" text="Niveles que escuchan todos los oyentes.">
          <div className="grid gap-6">
            <Slider name="bed_level" label="Volumen de la música de fondo" min={5} max={60} value={bed} onChange={setBed} hint="Cuánto baja la música al presionar «De fondo» o durante un bloque en vivo con fondo. Recomendado: 18–28%." />
            <Slider name="duck_level" label="Música bajo anuncios y capas" min={5} max={80} value={duck} onChange={setDuck} hint="A qué nivel queda la música mientras suena un audio que «baja la música» (anuncios, programas, capas y reproductores). Recomendado: 20–35%." />
            <Slider name="fx_level" label="Volumen general de efectos y capas" min={10} max={100} value={fx} onChange={setFx} hint="Tope de la botonera, los reproductores simultáneos y las capas programadas." />
            <Slider name="crossfade" label="Empalme entre canciones" min={0} max={10} value={crossfade} onChange={setCrossfade} unit=" s" hint="Segundos en que una canción de la música continua se funde con la siguiente. 0 = sin fundido. Recomendado: 3–5 s." />
            <label className="text-xs font-semibold text-muted">
              Oyentes de voz en vivo (máximo)
              <input name="max_voice" type="number" min={1} max={200} defaultValue={config.max_voice} required className={input} />
              <span className="mt-1 block font-normal leading-5">
                Tu voz se envía directo desde la consola a cada oyente, así que consume subida de internet: unos 64 kbps por oyente (60 oyentes ≈ 4 Mbps). Ajusta según tu conexión.
              </span>
            </label>
          </div>
        </Panel>

        <Panel title="Transmisión externa (opcional)" text="Para audiencias grandes. Si usas un servidor de streaming (Icecast, Shoutcast, Radio.co, Zeno.fm, etc.) pega aquí el enlace HTTPS del audio y la página lo reproducirá en lugar de la programación interna." className="xl:col-span-1">
          <label className="text-xs font-semibold text-muted">
            Enlace del stream (https://…)
            <input name="stream_url" type="url" defaultValue={config.stream_url} maxLength={300} placeholder="https://stream.ejemplo.com/zoe.mp3" className={input} />
          </label>
          <p className="mt-2 text-[12.5px] leading-5 text-muted">Déjalo vacío para usar la radio integrada con la programación y la consola de este panel.</p>
        </Panel>

        <Panel title="Servidor TURN (avanzado)" text="Ayuda a que tu voz llegue a oyentes en redes muy cerradas (algunas empresas o datos móviles). Sin TURN funciona para la gran mayoría.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Dirección
              <input name="turn_url" defaultValue={config.turn_url} maxLength={200} placeholder="turns:turn.ejemplo.com:443" className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Usuario
              <input name="turn_username" defaultValue={config.turn_username} maxLength={120} autoComplete="off" className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Contraseña
              <input name="turn_credential" type="password" defaultValue={config.turn_credential} maxLength={200} autoComplete="new-password" className={input} />
            </label>
          </div>
        </Panel>

        <div className="xl:col-span-2">
          <Notice result={result} onClose={() => setResult(null)} />
          <button disabled={pending} className={`${button} mt-3`}>{pending ? "Guardando…" : "Guardar ajustes"}</button>
        </div>
      </form>
    </AdminLayout>
  );
}

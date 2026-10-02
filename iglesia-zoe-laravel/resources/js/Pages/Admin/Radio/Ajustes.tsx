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

function Slider({ name, label, min, max, value, onChange, hint }: { name: string; label: string; min: number; max: number; value: number; onChange: (value: number) => void; hint: string }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-ink">{value}%</span>
      </span>
      <input type="range" name={name} min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[var(--color-accent)]" />
      <span className="mt-1 block font-normal leading-5">{hint}</span>
    </label>
  );
}

export default function Ajustes({ config }: { config: RadioConfig }) {
  const { result, setResult, pending, run } = useAction();
  const [bed, setBed] = useState(config.bed_level);
  const [fx, setFx] = useState(config.fx_level);

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
              name="autofill"
              defaultChecked={config.autofill}
              title="Música continua"
              text="Los espacios sin programación se llenan con las canciones «en rotación» de la biblioteca, en orden aleatorio y sin repetir seguidas. Si la apagas, esos espacios quedan en silencio."
            />
          </div>
        </Panel>

        <Panel title="Mezcla" text="Niveles que escuchan todos los oyentes.">
          <div className="grid gap-6">
            <Slider name="bed_level" label="Volumen de la música de fondo" min={5} max={60} value={bed} onChange={setBed} hint="Cuánto baja la música al presionar «Fondo» o durante un bloque en vivo con fondo. Recomendado: 18–28%." />
            <Slider name="fx_level" label="Volumen de efectos y anuncios" min={10} max={100} value={fx} onChange={setFx} hint="Nivel de los botones de efectos y anuncios que lanzas desde la consola." />
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

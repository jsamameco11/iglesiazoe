import { useMemo, type ReactNode } from "react";
import { EQ_BANDS, PRESETS, applyPreset, type Recipe } from "./recipe";

type Update = (patch: Partial<Recipe>, group?: string) => void;

const signed = (value: number, unit: string, digits = 1) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}${unit}`;

export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  format,
  group,
  onChange,
  badge,
  neutral = 0,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  group: string;
  onChange: Update;
  badge?: ReactNode;
  neutral?: number;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  const zero = ((neutral - min) / (max - min)) * 100;
  const changed = value !== neutral;
  return (
    <label className="block" title="Doble clic para volver a cero" onDoubleClick={() => onChange({ [group]: neutral } as Partial<Recipe>, group)}>
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {label}
          {badge}
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums ${changed ? "bg-orange-50 text-orange-deep" : "text-muted"}`}>{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange({ [group]: Number(event.target.value) } as Partial<Recipe>, group)}
        className="zoe-editor-range mt-2 w-full"
        style={{ "--from": `${Math.min(zero, percent)}%`, "--to": `${Math.max(zero, percent)}%` } as React.CSSProperties}
      />
      {hint && <span className="mt-1 block text-[11.5px] leading-[1.45] text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange, badge }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void; badge?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? "bg-accent" : "bg-black/15"}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {label}
          {badge}
        </span>
        {hint && <span className="mt-0.5 block text-[11.5px] leading-[1.45] text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/** Marks a treatment the browser cannot play live. */
export function FinalOnly() {
  return (
    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800" title="Este filtro se aplica en el servidor: escúchalo con «Escuchar el resultado final».">
      En la muestra final
    </span>
  );
}

function Section({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted">{text}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

/** The equalizer curve, computed with the same filters the preview uses. */
function EqCurve({ eq, lowcut }: { eq: number[]; lowcut: boolean }) {
  const points = useMemo(() => {
    const steps = 120;
    const frequencies = new Float32Array(steps).map((_, index) => 20 * Math.pow(1000, index / (steps - 1)));
    const total = new Float32Array(steps).fill(0);
    try {
      const context = new OfflineAudioContext(1, 128, 44100);
      const filters = [
        ...EQ_BANDS.map((band, index) => new BiquadFilterNode(context, { type: band.type, frequency: band.hz, Q: band.type === "peaking" ? 1 : Math.SQRT1_2, gain: eq[index] ?? 0 })),
        ...(lowcut ? [new BiquadFilterNode(context, { type: "highpass", frequency: 80, Q: Math.SQRT1_2 })] : []),
      ];
      const magnitude = new Float32Array(steps);
      const phase = new Float32Array(steps);
      for (const filter of filters) {
        filter.getFrequencyResponse(frequencies, magnitude, phase);
        magnitude.forEach((value, index) => (total[index] += 20 * Math.log10(Math.max(value, 1e-4))));
      }
    } catch {
      return null;
    }
    return Array.from(total, (db, index) => `${(index / (steps - 1)) * 100},${30 - Math.max(-15, Math.min(15, db)) * 1.8}`).join(" ");
  }, [eq, lowcut]);

  if (!points) return null;
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-20 w-full rounded-xl bg-[#fcfbf8]" aria-hidden>
      {[0.1, 0.33, 0.66, 0.9].map((x) => <line key={x} x1={x * 100} x2={x * 100} y1={0} y2={60} stroke="rgba(42,39,36,0.07)" strokeWidth={0.4} />)}
      <line x1={0} x2={100} y1={30} y2={30} stroke="rgba(42,39,36,0.18)" strokeWidth={0.5} strokeDasharray="1.5 1.5" />
      <polyline points={`0,60 ${points} 100,60`} fill="rgba(224,102,47,0.12)" stroke="none" />
      <polyline points={points} fill="none" stroke="#e0662f" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function SoundPanel({ recipe, onChange, onReplace }: { recipe: Recipe; onChange: Update; onReplace: (recipe: Recipe) => void }) {
  const manual = (patch: Partial<Recipe>, group?: string) => onChange({ ...patch, preset: null }, group);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Estilos de sonido</p>
        <p className="mt-0.5 text-[11.5px] text-muted">Un punto de partida en un clic. Luego afina con los controles de abajo.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PRESETS.map((preset) => {
            const active = (recipe.preset ?? "natural") === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onReplace(applyPreset(recipe, preset))}
                className={`rounded-2xl border px-3.5 py-2.5 text-left transition ${active ? "border-accent bg-orange-50/70 ring-2 ring-accent/20" : "border-line bg-white hover:border-ink/25"}`}
              >
                <span className="block text-[13px] font-semibold">{preset.name}</span>
                <span className="mt-0.5 block text-[11px] leading-[1.4] text-muted">{preset.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Section title="Voz y estéreo" text="Para cuando el cantante suena bajo frente a los instrumentos. Funciona en canciones estéreo: la voz principal suele ir al centro.">
        <Slider
          label="Resaltar voz"
          hint="Sube lo que suena al centro (la voz) y le da claridad, mientras baja un poco los instrumentos de los lados."
          value={recipe.voice}
          min={0}
          max={100}
          format={(value) => (value ? `${value}%` : "Apagado")}
          group="voice"
          onChange={manual}
        />
        <Slider
          label="Amplitud estéreo"
          hint="A la derecha suena más abierto y envolvente; a la izquierda, más concentrado al centro."
          value={recipe.width}
          min={-100}
          max={100}
          format={(value) => (value ? signed(value, "%", 0) : "Original")}
          group="width"
          onChange={manual}
        />
      </Section>

      <Section title="Ecualizador" text="Sube o baja cada zona del sonido. Cambios pequeños (2 a 4 dB) suelen bastar. Doble clic en un control lo devuelve a cero.">
        <EqCurve eq={recipe.eq} lowcut={recipe.lowcut} />
        <div className="grid grid-cols-5 gap-2">
          {EQ_BANDS.map((band, index) => {
            const value = recipe.eq[index] ?? 0;
            const setBand = (next: number) => manual({ eq: recipe.eq.map((gain, position) => (position === index ? next : gain)) }, `eq${index}`);
            return (
              <div key={band.hz} className="flex flex-col items-center text-center" onDoubleClick={() => setBand(0)} title={`${band.hint}. Doble clic para volver a cero`}>
                <span className={`text-[11px] font-semibold tabular-nums ${value ? "text-orange-deep" : "text-muted"}`}>{signed(value, "", 1)}</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={value}
                  onChange={(event) => setBand(Number(event.target.value))}
                  className="zoe-editor-range zoe-editor-vertical my-2 h-28"
                  style={{ "--from": `${Math.min(50, ((value + 12) / 24) * 100)}%`, "--to": `${Math.max(50, ((value + 12) / 24) * 100)}%` } as React.CSSProperties}
                  aria-label={`${band.label} (${band.hz >= 1000 ? `${band.hz / 1000} kHz` : `${band.hz} Hz`})`}
                />
                <span className="text-[12px] font-semibold">{band.label}</span>
                <span className="text-[10px] text-muted">{band.hz >= 1000 ? `${band.hz / 1000} kHz` : `${band.hz} Hz`}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Volumen y dinámica" text="Para que suene parejo, con cuerpo y al mismo volumen que el resto de la radio.">
        <Slider
          label="Compresión"
          hint="Empareja lo fuerte y lo suave: las partes bajas se entienden mejor y el audio suena más «de radio»."
          value={recipe.compress}
          min={0}
          max={100}
          format={(value) => (value ? `${value}%` : "Apagado")}
          group="compress"
          onChange={manual}
        />
        <Slider label="Volumen" hint="Sube o baja todo el audio." value={recipe.gain} min={-12} max={12} step={0.5} format={(value) => signed(value, " dB")} group="gain" onChange={manual} />
        <Toggle
          label="Normalizar volumen"
          hint="Deja el audio al volumen estándar de la radio (−14 LUFS), medido con precisión al guardar y sin distorsión."
          checked={recipe.normalize}
          onChange={(normalize) => manual({ normalize }, "normalize")}
        />
      </Section>

      <Section title="Limpieza" text="Para grabaciones con ruido, zumbidos o «eses» que silban.">
        <Toggle label="Quitar retumbe" hint="Elimina zumbidos y golpes graves que no son música (debajo de 80 Hz). Limpia sin perder el bajo." checked={recipe.lowcut} onChange={(lowcut) => manual({ lowcut }, "lowcut")} />
        <Slider
          label="Reducir ruido de fondo"
          hint="Quita soplido, siseo y ruido constante. Úsalo con moderación: demasiado vuelve el sonido metálico."
          value={recipe.denoise}
          min={0}
          max={100}
          format={(value) => (value ? `${value}%` : "Apagado")}
          group="denoise"
          onChange={manual}
          badge={<FinalOnly />}
        />
        <Slider
          label="Suavizar «eses»"
          hint="Baja los silbidos de las «s» y «ch» que molestan en voces brillantes."
          value={recipe.deess}
          min={0}
          max={100}
          format={(value) => (value ? `${value}%` : "Apagado")}
          group="deess"
          onChange={manual}
          badge={<FinalOnly />}
        />
      </Section>
    </div>
  );
}

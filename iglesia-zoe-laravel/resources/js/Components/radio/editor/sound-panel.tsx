import { useMemo, useRef, useState, type ReactNode } from "react";
import { EQ_BANDS, PRESETS, applyPreset, type Recipe } from "./recipe";

type Update = (patch: Partial<Recipe>, group?: string) => void;

const EQ_MAX = 12;

const frequency = (hz: number) => (hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`);

/** Position of a frequency on the 20 Hz – 20 kHz log axis, from 0 to 100. */
const axis = (hz: number) => (Math.log10(hz / 20) / 3) * 100;

/**
 * A value typed by hand: accepts comma or point, clamps to the range and rounds to the precision
 * the server keeps. Enter or leaving the field applies it, Esc discards it, ↑ ↓ nudge it (Shift: ×10).
 */
export function NumberField({
  value,
  min,
  max,
  step,
  digits,
  unit,
  signed = false,
  neutral = 0,
  label,
  onCommit,
  className = "",
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  unit?: string;
  signed?: boolean;
  neutral?: number;
  label: string;
  onCommit: (value: number) => void;
  className?: string;
}) {
  const [draft, setDraftState] = useState<string | null>(null);
  const typed = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    typed.current = next;
    setDraftState(next);
  };
  const show = (number: number) => `${signed && number > 0 ? "+" : ""}${number.toFixed(digits)}`;
  const fit = (number: number) => {
    const factor = 10 ** digits;
    return Math.min(max, Math.max(min, Math.round(number * factor) / factor));
  };

  const commit = () => {
    const text = typed.current;
    setDraft(null);
    if (text === null) return;
    const parsed = Number(text.trim().replace(",", ".").replace("−", "-"));
    if (text.trim() !== "" && Number.isFinite(parsed)) onCommit(fit(parsed));
  };

  const nudge = (direction: 1 | -1, large: boolean) => {
    const next = fit(value + direction * step * (large ? 10 : 1));
    setDraft(show(next));
    onCommit(next);
  };

  return (
    <span
      className={`inline-flex h-7 items-center rounded-lg border bg-white pr-2 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${value !== neutral ? "border-orange-200 bg-orange-50/60" : "border-line"} ${className}`}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? show(value)}
        onFocus={(event) => {
          setDraft(show(value));
          const field = event.currentTarget;
          requestAnimationFrame(() => field.select());
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent pl-2 text-right text-[12px] font-semibold tabular-nums outline-none"
      />
      {unit && <span className="ml-1 shrink-0 text-[11px] font-medium text-muted">{unit}</span>}
    </span>
  );
}

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
  unit,
  digits = 0,
  signed = false,
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
  unit?: string;
  digits?: number;
  signed?: boolean;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  const zero = ((neutral - min) / (max - min)) * 100;
  const set = (next: number) => onChange({ [group]: next } as Partial<Recipe>, group);
  return (
    <div title="Doble clic para volver a cero" onDoubleClick={() => set(neutral)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold">
          {label}
          {badge}
        </span>
        <NumberField value={value} min={min} max={max} step={step} digits={digits} unit={unit} signed={signed} neutral={neutral} label={label} onCommit={set} className="w-[5.25rem] shrink-0" />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format(value)}
        onChange={(event) => set(Number(event.target.value))}
        className="zoe-editor-range mt-2 w-full"
        style={{ "--from": `${Math.min(zero, percent)}%`, "--to": `${Math.max(zero, percent)}%` } as React.CSSProperties}
      />
      <div className="flex items-start justify-between gap-3">
        {hint && <span className="block text-[11.5px] leading-[1.45] text-muted">{hint}</span>}
        <span className={`shrink-0 text-[11px] font-medium ${value !== neutral ? "text-orange-deep" : "text-muted/70"}`}>{format(value)}</span>
      </div>
    </div>
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

function Section({ title, text, actions, className = "", children }: { title: string; text: string; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col rounded-2xl border border-line bg-white p-4 md:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em]">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted">{text}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

/** The equalizer curve, computed with the same filters the preview uses, with a dot on each band. */
function EqCurve({ eq, lowcut }: { eq: number[]; lowcut: boolean }) {
  const curve = useMemo(() => {
    const steps = 160;
    const frequencies = new Float32Array(steps + EQ_BANDS.length);
    for (let index = 0; index < steps; index++) frequencies[index] = 20 * Math.pow(1000, index / (steps - 1));
    EQ_BANDS.forEach((band, index) => (frequencies[steps + index] = band.hz));
    const total = new Float32Array(frequencies.length).fill(0);
    try {
      const context = new OfflineAudioContext(1, 128, 44100);
      const filters = [
        ...EQ_BANDS.map((band, index) => new BiquadFilterNode(context, { type: band.type, frequency: band.hz, Q: band.type === "peaking" ? 1 : Math.SQRT1_2, gain: eq[index] ?? 0 })),
        ...(lowcut ? [new BiquadFilterNode(context, { type: "highpass", frequency: 80, Q: Math.SQRT1_2 })] : []),
      ];
      const magnitude = new Float32Array(frequencies.length);
      const phase = new Float32Array(frequencies.length);
      for (const filter of filters) {
        filter.getFrequencyResponse(frequencies, magnitude, phase);
        magnitude.forEach((value, index) => (total[index] += 20 * Math.log10(Math.max(value, 1e-4))));
      }
    } catch {
      return null;
    }
    const y = (db: number) => 50 - (Math.max(-EQ_MAX * 1.25, Math.min(EQ_MAX * 1.25, db)) / (EQ_MAX * 1.25)) * 46;
    return {
      line: Array.from(total.slice(0, steps), (db, index) => `${(index / (steps - 1)) * 100},${y(db)}`).join(" "),
      dots: EQ_BANDS.map((band, index) => ({ x: axis(band.hz), y: y(total[steps + index]) })),
      y,
    };
  }, [eq, lowcut]);

  if (!curve) return null;
  return (
    <div className="relative rounded-xl border border-line/70 bg-[#fcfbf8]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block h-36 w-full" aria-hidden>
        {[6, -6].map((db) => <line key={db} x1={0} x2={100} y1={curve.y(db)} y2={curve.y(db)} stroke="rgba(42,39,36,0.06)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />)}
        {[12, -12].map((db) => <line key={db} x1={0} x2={100} y1={curve.y(db)} y2={curve.y(db)} stroke="rgba(42,39,36,0.1)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />)}
        {EQ_BANDS.map((band) => <line key={band.hz} x1={axis(band.hz)} x2={axis(band.hz)} y1={0} y2={100} stroke="rgba(42,39,36,0.07)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />)}
        <line x1={0} x2={100} y1={50} y2={50} stroke="rgba(42,39,36,0.22)" strokeWidth={0.75} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <polyline points={`0,100 ${curve.line} 100,100`} fill="rgba(224,102,47,0.1)" stroke="none" />
        <polyline points={curve.line} fill="none" stroke="#e0662f" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      </svg>
      {curve.dots.map((dot, index) => (
        <span
          key={EQ_BANDS[index].hz}
          className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${eq[index] ? "bg-accent" : "bg-ink/35"}`}
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
        />
      ))}
      <span className="pointer-events-none absolute left-2 top-1.5 text-[9.5px] font-semibold tabular-nums text-muted/70">+12 dB</span>
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-[calc(100%+2px)] text-[9.5px] font-semibold tabular-nums text-muted/70">0</span>
      <span className="pointer-events-none absolute bottom-1.5 left-2 text-[9.5px] font-semibold tabular-nums text-muted/70">−12 dB</span>
      <span className="pointer-events-none absolute bottom-1.5 right-2 text-[9.5px] font-semibold text-muted/70">20 Hz – 20 kHz</span>
    </div>
  );
}

function Equalizer({ recipe, onChange }: { recipe: Recipe; onChange: Update }) {
  const flat = recipe.eq.every((gain) => gain === 0);
  const setBand = (index: number, gain: number) => onChange({ eq: recipe.eq.map((value, position) => (position === index ? gain : value)) }, `eq${index}`);
  return (
    <Section
      title="Ecualizador"
      text="Sube o baja cada zona del sonido con el control o escribiendo los dB. Cambios pequeños (2 a 4 dB) suelen bastar."
      className="lg:col-span-2 xl:col-span-7"
      actions={
        <button type="button" onClick={() => onChange({ eq: recipe.eq.map(() => 0) }, "eq")} disabled={flat} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[11.5px] font-semibold text-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-40">
          Dejar plano
        </button>
      }
    >
      <EqCurve eq={recipe.eq} lowcut={recipe.lowcut} />
      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
        {EQ_BANDS.map((band, index) => {
          const gain = recipe.eq[index] ?? 0;
          const percent = ((gain + EQ_MAX) / (EQ_MAX * 2)) * 100;
          return (
            <div
              key={band.hz}
              className={`flex flex-col items-center rounded-xl border px-1.5 pb-2.5 pt-2 text-center transition ${gain ? "border-orange-200 bg-orange-50/40" : "border-line/70 bg-[#fcfbf8]"}`}
              onDoubleClick={() => setBand(index, 0)}
              title={`${band.hint}. Doble clic para volver a cero`}
            >
              <span className="text-[12.5px] font-semibold leading-tight">{band.label}</span>
              <span className="text-[10.5px] tabular-nums text-muted">{frequency(band.hz)}</span>
              <input
                type="range"
                min={-EQ_MAX}
                max={EQ_MAX}
                step={0.5}
                value={gain}
                onChange={(event) => setBand(index, Number(event.target.value))}
                className="zoe-editor-range zoe-editor-vertical my-3"
                style={{ "--from": `${Math.min(50, percent)}%`, "--to": `${Math.max(50, percent)}%` } as React.CSSProperties}
                aria-label={`${band.label} (${frequency(band.hz)})`}
                aria-valuetext={`${gain > 0 ? "+" : ""}${gain} dB`}
              />
              <NumberField
                value={gain}
                min={-EQ_MAX}
                max={EQ_MAX}
                step={0.5}
                digits={1}
                unit="dB"
                signed
                label={`${band.label} en dB`}
                onCommit={(next) => setBand(index, next)}
                className="w-full max-w-[5.5rem]"
              />
              <span className="mt-1.5 hidden text-[10.5px] leading-tight text-muted lg:block">{band.hint}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function SoundPanel({ recipe, onChange, onReplace }: { recipe: Recipe; onChange: Update; onReplace: (recipe: Recipe) => void }) {
  const manual = (patch: Partial<Recipe>, group?: string) => onChange({ ...patch, preset: null }, group);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold">Estilos de sonido</p>
          <p className="text-[11.5px] text-muted">Un punto de partida en un clic. Luego afina con los controles.</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((preset) => {
            const active = (recipe.preset ?? "natural") === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onReplace(applyPreset(recipe, preset))}
                aria-pressed={active}
                className={`rounded-2xl border px-3.5 py-2.5 text-left transition ${active ? "border-accent bg-orange-50/70 ring-2 ring-accent/20" : "border-line bg-white hover:border-ink/25"}`}
              >
                <span className="block text-[13px] font-semibold">{preset.name}</span>
                <span className="mt-0.5 block text-[11px] leading-[1.4] text-muted">{preset.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Equalizer recipe={recipe} onChange={manual} />

        <Section title="Volumen y dinámica" text="Para que suene parejo, con cuerpo y al mismo volumen que el resto de la radio." className="xl:col-span-5">
          <div className="space-y-5">
            <Slider
              label="Compresión"
              hint="Empareja lo fuerte y lo suave: las partes bajas se entienden mejor y el audio suena más «de radio»."
              value={recipe.compress}
              min={0}
              max={100}
              unit="%"
              format={(value) => (value ? "Activa" : "Apagado")}
              group="compress"
              onChange={manual}
            />
            <Slider label="Volumen" hint="Sube o baja todo el audio." value={recipe.gain} min={-EQ_MAX} max={EQ_MAX} step={0.5} digits={1} signed unit="dB" format={(value) => (value ? (value > 0 ? "Más fuerte" : "Más suave") : "Original")} group="gain" onChange={manual} />
            <div className="rounded-xl bg-[#fcfbf8] p-3">
              <Toggle
                label="Normalizar volumen"
                hint="Deja el audio al volumen estándar de la radio (−14 LUFS), medido con precisión al guardar y sin distorsión."
                checked={recipe.normalize}
                onChange={(normalize) => manual({ normalize }, "normalize")}
              />
            </div>
          </div>
        </Section>

        <Section title="Voz y estéreo" text="Para cuando el cantante suena bajo frente a los instrumentos. Funciona en canciones estéreo: la voz principal suele ir al centro." className="xl:col-span-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Slider
              label="Resaltar voz"
              hint="Sube lo que suena al centro (la voz) y le da claridad, mientras baja un poco los instrumentos de los lados."
              value={recipe.voice}
              min={0}
              max={100}
              unit="%"
              format={(value) => (value ? "Activo" : "Apagado")}
              group="voice"
              onChange={manual}
            />
            <Slider
              label="Amplitud estéreo"
              hint="A la derecha suena más abierto y envolvente; a la izquierda, más concentrado al centro."
              value={recipe.width}
              min={-100}
              max={100}
              unit="%"
              signed
              format={(value) => (value ? (value > 0 ? "Más abierto" : "Más centrado") : "Original")}
              group="width"
              onChange={manual}
            />
          </div>
        </Section>

        <Section title="Limpieza" text="Para grabaciones con ruido, zumbidos o «eses» que silban." className="xl:col-span-6">
          <div className="space-y-5">
            <div className="rounded-xl bg-[#fcfbf8] p-3">
              <Toggle label="Quitar retumbe" hint="Elimina zumbidos y golpes graves que no son música (debajo de 80 Hz). Limpia sin perder el bajo." checked={recipe.lowcut} onChange={(lowcut) => manual({ lowcut }, "lowcut")} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Slider
                label="Reducir ruido"
                hint="Quita soplido, siseo y ruido constante. Con moderación: demasiado vuelve el sonido metálico."
                value={recipe.denoise}
                min={0}
                max={100}
                unit="%"
                format={(value) => (value ? "Activo" : "Apagado")}
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
                unit="%"
                format={(value) => (value ? "Activo" : "Apagado")}
                group="deess"
                onChange={manual}
                badge={<FinalOnly />}
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

import type { Typography } from "@/lib/design";
import { RangeField, SelectField, Toggle } from "./fields";

const weights = [
  { value: 300, label: "Ligera" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Media" },
  { value: 600, label: "Seminegrita" },
  { value: 700, label: "Negrita" },
  { value: 800, label: "Extra negrita" },
];

const em = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 1000) / 10} %`;

/** Weight, line height, letter spacing and style of titles and paragraphs. */
export function TypeFields({ rule, set, from }: { rule: Typography; set: (patch: Partial<Typography>) => void; from: string }) {
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Títulos</p>
        <SelectField<number> label="Grosor" value={rule.titleWeight} options={weights} placeholder={`Igual que ${from}`} onChange={(titleWeight) => set({ titleWeight })} />
        <RangeField label="Interlineado" value={rule.titleLeading} fallback={1.1} min={0.8} max={1.8} step={0.05} format={(value) => value.toFixed(2)} onChange={(titleLeading) => set({ titleLeading })} />
        <RangeField label="Espaciado entre letras" value={rule.titleTracking} fallback={0} min={-0.06} max={0.3} step={0.005} format={em} onChange={(titleTracking) => set({ titleTracking })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="MAYÚSCULAS" checked={Boolean(rule.titleUpper)} onChange={(titleUpper) => set({ titleUpper })} />
          <Toggle label="Cursiva" checked={Boolean(rule.titleItalic)} onChange={(titleItalic) => set({ titleItalic })} />
        </div>
      </div>
      <div className="space-y-4 border-t border-line pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Párrafos</p>
        <SelectField<number> label="Grosor" value={rule.textWeight} options={weights.slice(0, 4)} placeholder={`Igual que ${from}`} onChange={(textWeight) => set({ textWeight })} />
        <RangeField label="Interlineado" value={rule.textLeading} fallback={1.6} min={1.1} max={2.4} step={0.05} format={(value) => value.toFixed(2)} onChange={(textLeading) => set({ textLeading })} />
        <RangeField label="Espaciado entre letras" value={rule.textTracking} fallback={0} min={-0.03} max={0.2} step={0.005} format={em} onChange={(textTracking) => set({ textTracking })} />
      </div>
    </div>
  );
}

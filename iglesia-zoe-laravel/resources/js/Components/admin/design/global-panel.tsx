import { fontRoles, fontStack, zoePalette, type Design, type FontCategory, type FontOption, type Palette } from "@/lib/design";
import { Choice, ColorField, RangeField, RoleField, ScaleField, SelectField } from "./fields";
import { FontPicker } from "./font-picker";
import type { Draft } from "./use-draft";

const presets: { name: string; palette: Palette }[] = [
  { name: "Zoe", palette: { ...zoePalette } },
  { name: "Arena", palette: { paper: "#f6f1e9", card: "#fffaf2", ink: "#2a2420", muted: "#7d7268", line: "#e8dfd2", accent: "#c45c26", stone: "#eadfce", clay: "#edd4c2" } },
  { name: "Piedra", palette: { paper: "#f4f3f0", card: "#fbfaf7", ink: "#2a2623", muted: "#6f6a64", line: "#e2dfd8", accent: "#c45c26", stone: "#ddd9d1", clay: "#e4d0c4" } },
  { name: "Noche", palette: { paper: "#f7f4ef", card: "#ffffff", ink: "#1d2430", muted: "#5b6270", line: "#e3e0da", accent: "#b8562a", stone: "#e7e2d9", clay: "#ecd6c6" } },
];

const paletteFields: { key: keyof Palette; label: string; text: string }[] = [
  { key: "accent", label: "Acento", text: "Botones y llamadas a la acción" },
  { key: "ink", label: "Títulos", text: "Títulos y franjas oscuras" },
  { key: "muted", label: "Textos", text: "Párrafos y descripciones" },
  { key: "paper", label: "Fondo", text: "Fondo de todas las páginas" },
  { key: "card", label: "Tarjetas", text: "Tarjetas y formularios" },
  { key: "stone", label: "Arena", text: "Bloques de apoyo" },
  { key: "clay", label: "Terracota", text: "Secciones cálidas" },
  { key: "line", label: "Líneas", text: "Bordes y separadores" },
];

const navWeights = [
  { value: 300, label: "Ligera" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Media" },
  { value: 600, label: "Seminegrita" },
  { value: 700, label: "Negrita" },
];

const px = (value: number) => `${value} px`;

const samples = { heading: "Vida en abundancia", text: "Una familia que se reúne cada semana para crecer en Cristo.", accent: "PRÓXIMO DOMINGO · 10:30 AM" };

function Group({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line pb-6 last:border-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">{text}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function GlobalPanel({ draft, fonts, categories }: { draft: Draft; fonts: FontOption[]; categories: FontCategory[] }) {
  const { design } = draft;
  const nav = design.nav ?? {};

  return (
    <div className="space-y-6">
      <Group title="Paleta de colores" text="Se aplica en toda la web y en el panel. Cada página o sección puede cambiar sus propios colores.">
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = JSON.stringify(preset.palette) === JSON.stringify(design.palette);
            return (
              <button key={preset.name} type="button" onClick={() => draft.setPalette(preset.palette)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}>
                <span className="flex -space-x-1">
                  {(["paper", "ink", "accent"] as const).map((key) => <span key={key} className="h-4 w-4 rounded-full border border-white" style={{ background: preset.palette[key] }} />)}
                </span>
                {preset.name}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {paletteFields.map((field) => (
            <ColorField key={field.key} label={field.label} text={field.text} value={design.palette[field.key] === zoePalette[field.key] ? "" : design.palette[field.key]} fallback={zoePalette[field.key]} onChange={(value) => draft.setPalette({ [field.key]: value || zoePalette[field.key] })} />
          ))}
        </div>
      </Group>

      <Group title="Tipografías" text={`Por defecto la web usa tres: una para títulos, otra para textos y otra para acentos. Elige cada una entre ${fonts.length} tipografías ordenadas en ${categories.length} categorías. ¿Un texto puntual con otra letra? Usa la pestaña «Textos».`}>
        <div className="space-y-3">
          {fontRoles.map((role) => (
            <div key={role.key} className="space-y-2.5 rounded-2xl border border-line bg-paper/40 p-3">
              <p className="text-xs font-semibold text-ink">
                {role.label} <span className="font-normal text-muted">· {role.text}</span>
              </p>
              <FontPicker fonts={fonts} categories={categories} current={design.fonts[role.key]} sample={samples[role.key]} onPick={(font) => draft.setFont(role.key, font)} />
              <p className={`px-1 leading-tight text-ink ${role.key === "heading" ? "text-2xl font-semibold" : role.key === "accent" ? "text-xs font-semibold tracking-[0.18em]" : "text-sm"}`} style={{ fontFamily: fontStack(design.fonts[role.key]) }}>
                {samples[role.key]}
              </p>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Menú de navegación" text="Enlaces de la barra superior y opciones que se despliegan de ellos. Sin cambios, el menú conserva su aspecto original.">
        <div className="space-y-5">
          <RoleField label="Tipografía" value={nav.font} fallback="text" original="Original (Inter Tight)" onChange={(font) => draft.setNav({ font })} />
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Enlaces del menú</p>
            <RangeField label="Tamaño" value={nav.size} fallback={16} min={12} max={19} step={0.5} format={px} onChange={(size) => draft.setNav({ size })} />
            <SelectField<number> label="Grosor" value={nav.weight} options={navWeights} placeholder="Original (Media)" onChange={(weight) => draft.setNav({ weight })} />
          </div>
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Opciones desplegables</p>
            <RangeField label="Tamaño" value={nav.dropSize} fallback={15} min={12} max={18} step={0.5} format={px} onChange={(dropSize) => draft.setNav({ dropSize })} />
            <SelectField<number> label="Grosor" value={nav.dropWeight} options={navWeights} placeholder="Original (Normal)" onChange={(dropWeight) => draft.setNav({ dropWeight })} />
          </div>
          <div className="border-t border-line pt-4">
            <RangeField label="Espaciado entre letras" value={nav.tracking} fallback={-0.01} min={-0.03} max={0.2} step={0.005} format={(value) => `${value > 0 ? "+" : ""}${Math.round(value * 1000) / 10} %`} onChange={(tracking) => draft.setNav({ tracking })} />
          </div>
        </div>
      </Group>

      <Group title="Tamaños de texto" text="100 % es el tamaño original. Cada página puede ajustarlo aparte.">
        <div className="space-y-4">
          {(["title", "subtitle", "text"] as const).map((key) => (
            <ScaleField key={key} label={{ title: "Títulos", subtitle: "Subtítulos", text: "Párrafos" }[key]} value={design.sizes[key]} onChange={(value) => draft.setSize(key, value)} />
          ))}
        </div>
      </Group>

      <Group title="Formas" text="Esquinas de botones, tarjetas e imágenes.">
        <Choice<Design["shape"]>
          value={design.shape}
          options={[{ key: "round", label: "Redondeadas" }, { key: "soft", label: "Suaves" }, { key: "square", label: "Rectas" }]}
          onChange={draft.setShape}
        />
      </Group>
    </div>
  );
}

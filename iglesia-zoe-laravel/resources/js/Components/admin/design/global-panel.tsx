import { useEffect } from "react";
import { fontHref, fontRoles, fontStack, zoePalette, type Design, type FontOption, type Palette } from "@/lib/design";
import { Choice, ColorField, ScaleField } from "./fields";
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

const kinds: { key: FontOption["kind"]; label: string }[] = [
  { key: "serif", label: "Con serifa" },
  { key: "sans", label: "Sin serifa" },
  { key: "round", label: "Redondeadas" },
];

const samples = { heading: "Vida en abundancia", text: "Una familia que se reúne cada semana para crecer en Cristo.", accent: "PRÓXIMO DOMINGO · 10 AM" };

function Group({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line pb-6 last:border-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-xs leading-5 text-muted">{text}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function GlobalPanel({ draft, fonts }: { draft: Draft; fonts: FontOption[] }) {
  const { design } = draft;

  useEffect(() => {
    const id = "zoe-design-catalog";
    if (document.getElementById(id)) return;
    const link = Object.assign(document.createElement("link"), { id, rel: "stylesheet", href: fontHref(fonts) });
    document.head.appendChild(link);
  }, [fonts]);

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

      <Group title="Tipografías" text="La web usa solo tres: una para títulos, otra para textos y otra para acentos. Cada página y sección elige cuál de las tres usa.">
        <div className="space-y-3">
          {fontRoles.map((role) => (
            <div key={role.key} className="rounded-2xl border border-line bg-white p-3.5">
              <label className="block text-xs font-semibold text-muted">
                {role.label} <span className="font-normal">· {role.text}</span>
                <select
                  value={design.fonts[role.key].name}
                  onChange={(event) => {
                    const font = fonts.find((item) => item.name === event.target.value);
                    if (font) draft.setFont(role.key, font);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
                >
                  {kinds.map((kind) => (
                    <optgroup key={kind.key} label={kind.label}>
                      {fonts.filter((font) => font.kind === kind.key).map((font) => <option key={font.name} value={font.name}>{font.name}{font.local ? " · incluida" : ""}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <p className={`mt-3 leading-tight text-ink ${role.key === "heading" ? "text-2xl font-semibold" : role.key === "accent" ? "text-xs font-semibold tracking-[0.18em]" : "text-sm"}`} style={{ fontFamily: fontStack(design.fonts[role.key]) }}>
                {samples[role.key]}
              </p>
            </div>
          ))}
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

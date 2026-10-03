import type { SectionInfo, SectionRule } from "@/lib/design";
import { BackdropFields } from "./backdrop-fields";
import { ColorField, Group, RoleField, ScaleField, Toggle } from "./fields";
import { TypeFields } from "./type-fields";
import type { Draft } from "./use-draft";

const has = (rule: SectionRule, keys: (keyof SectionRule)[]) => keys.some((key) => rule[key] !== undefined);

export function SectionPanel({ draft, page, section, onBack }: { draft: Draft; page: string; section: SectionInfo; onBack: () => void }) {
  const { design } = draft;
  const pageRule = design.pages[page] ?? {};
  const rule = pageRule.sections?.[section.key] ?? {};
  const set = (patch: Parameters<Draft["setSection"]>[2]) => draft.setSection(page, section.key, patch);
  const changed = (keys: (keyof SectionRule)[]) => (has(rule, keys) ? "Cambiado" : undefined);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs font-semibold text-muted hover:text-ink">← Toda la página</button>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Sección</p>
        <h3 className="mt-1 text-lg font-semibold leading-tight text-ink">{section.label}</h3>
      </div>

      <Toggle label="Ocultar esta sección" text="No se muestra a los visitantes. En la vista previa se ve en gris." checked={Boolean(rule.hidden)} onChange={(hidden) => set({ hidden })} />

      <Group title="Fondo de la franja" text="Color, degradado, foto, GIF o video" open badge={changed(["background", "background2", "image", "video"])}>
        <BackdropFields rule={rule} base={pageRule.background || design.palette.paper} set={set} where="section" />
      </Group>

      <Group title="Colores del texto" text="Títulos, párrafos y acento" badge={changed(["titleColor", "textColor", "accentColor"])}>
        <div className="grid gap-2.5">
          <ColorField label="Color de títulos" text="Igual que la página" value={rule.titleColor} fallback={pageRule.titleColor || design.palette.ink} onChange={(titleColor) => set({ titleColor })} />
          <ColorField label="Color de textos" text="Igual que la página" value={rule.textColor} fallback={pageRule.textColor || design.palette.muted} onChange={(textColor) => set({ textColor })} />
          <ColorField label="Color de acento" text="Igual que la página" value={rule.accentColor} fallback={pageRule.accentColor || design.palette.accent} onChange={(accentColor) => set({ accentColor })} />
        </div>
      </Group>

      <Group title="Tipografía" text="Letra, tamaño, grosor, interlineado y espaciado" badge={changed(["titleFont", "textFont", "title", "text_size", "titleWeight", "textWeight", "titleLeading", "textLeading", "titleTracking", "textTracking", "titleUpper", "titleItalic"])}>
        <div className="grid gap-3 sm:grid-cols-2">
          <RoleField label="Títulos con" value={rule.titleFont} fallback={pageRule.titleFont ?? "heading"} from="la página" onChange={(titleFont) => set({ titleFont })} />
          <RoleField label="Textos con" value={rule.textFont} fallback={pageRule.textFont ?? "text"} from="la página" onChange={(textFont) => set({ textFont })} />
        </div>
        <ScaleField label="Tamaño de títulos" value={rule.title ?? 1} inherited={rule.title === undefined} onChange={(title) => set({ title })} onReset={() => set({ title: undefined })} />
        <ScaleField label="Tamaño de párrafos" value={rule.text_size ?? 1} inherited={rule.text_size === undefined} onChange={(text_size) => set({ text_size })} onReset={() => set({ text_size: undefined })} />
        <TypeFields rule={rule} set={set} from="la página" />
      </Group>

      {pageRule.sections?.[section.key] && (
        <button type="button" onClick={() => draft.setSection(page, section.key, null)} className="text-xs font-semibold text-red-700">
          Quitar los ajustes de esta sección
        </button>
      )}
    </div>
  );
}

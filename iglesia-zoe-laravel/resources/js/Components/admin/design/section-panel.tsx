import type { SectionInfo } from "@/lib/design";
import { ColorField, RoleField, ScaleField, Toggle } from "./fields";
import type { Draft } from "./use-draft";

export function SectionPanel({ draft, page, section, onBack }: { draft: Draft; page: string; section: SectionInfo; onBack: () => void }) {
  const { design } = draft;
  const pageRule = design.pages[page] ?? {};
  const rule = pageRule.sections?.[section.key] ?? {};
  const set = (patch: Parameters<Draft["setSection"]>[2]) => draft.setSection(page, section.key, patch);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-xs font-semibold text-muted hover:text-ink">← Toda la página</button>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Sección</p>
        <h3 className="mt-1 text-lg font-semibold leading-tight text-ink">{section.label}</h3>
      </div>

      <Toggle label="Ocultar esta sección" text="No se muestra a los visitantes. En la vista previa se ve en gris." checked={Boolean(rule.hidden)} onChange={(hidden) => set({ hidden })} />

      <div className="grid gap-2.5">
        <ColorField label="Fondo" text="Igual que la página" value={rule.background} fallback={pageRule.background || design.palette.paper} onChange={(background) => set({ background })} />
        <ColorField label="Color de títulos" text="Igual que la página" value={rule.titleColor} fallback={pageRule.titleColor || design.palette.ink} onChange={(titleColor) => set({ titleColor })} />
        <ColorField label="Color de textos" text="Igual que la página" value={rule.textColor} fallback={pageRule.textColor || design.palette.muted} onChange={(textColor) => set({ textColor })} />
        <ColorField label="Color de acento" text="Igual que la página" value={rule.accentColor} fallback={pageRule.accentColor || design.palette.accent} onChange={(accentColor) => set({ accentColor })} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleField label="Títulos con" value={rule.titleFont} fallback={pageRule.titleFont ?? "heading"} from="la página" onChange={(titleFont) => set({ titleFont })} />
        <RoleField label="Textos con" value={rule.textFont} fallback={pageRule.textFont ?? "text"} from="la página" onChange={(textFont) => set({ textFont })} />
      </div>

      <ScaleField label="Tamaño de títulos" value={rule.title ?? 1} inherited={rule.title === undefined} onChange={(title) => set({ title })} onReset={() => set({ title: undefined })} />

      {pageRule.sections?.[section.key] && (
        <button type="button" onClick={() => draft.setSection(page, section.key, null)} className="text-xs font-semibold text-red-700">
          Quitar los ajustes de esta sección
        </button>
      )}
    </div>
  );
}

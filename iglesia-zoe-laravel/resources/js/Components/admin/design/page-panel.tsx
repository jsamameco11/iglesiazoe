import type { DesignPage, PageRule, SectionInfo } from "@/lib/design";
import { BackdropFields } from "./backdrop-fields";
import { ColorField, Group, RoleField, ScaleField } from "./fields";
import { SectionPanel } from "./section-panel";
import { TypeFields } from "./type-fields";
import type { Draft } from "./use-draft";

const has = (rule: PageRule, keys: (keyof PageRule)[]) => keys.some((key) => rule[key] !== undefined);

export function PagePanel({ draft, page, sections, section, onSection }: { draft: Draft; page: DesignPage; sections: SectionInfo[]; section: string | null; onSection: (key: string | null) => void }) {
  const { design } = draft;
  const rule = design.pages[page.key] ?? {};
  const set = (patch: Parameters<Draft["setPage"]>[1]) => draft.setPage(page.key, patch);
  const picked = sections.find((item) => item.key === section);
  const changed = (keys: (keyof PageRule)[]) => (has(rule, keys) ? "Cambiado" : undefined);

  if (picked) {
    return <SectionPanel draft={draft} page={page.key} section={picked} onBack={() => onSection(null)} />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 border-b border-line pb-6">
        <div>
          <h3 className="text-sm font-semibold text-ink">Toda la página «{page.label}»</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted">Fondo, colores y tipografías solo de esta página. Cada sección puede cambiarlos de nuevo.</p>
        </div>

        <Group title="Fondo de pantalla" text="Color, degradado, foto, GIF o video detrás de la página" badge={changed(["background", "background2", "image", "video"])}>
          <BackdropFields rule={rule} base={design.palette.paper} set={set} where="page" />
          <p className="text-[11px] leading-4 text-muted">Se ve detrás de las secciones que no tienen fondo propio.</p>
        </Group>

        <Group title="Colores del texto" text="Títulos, párrafos, botones y enlaces" badge={changed(["titleColor", "textColor", "accentColor"])}>
          <div className="grid gap-2.5">
            <ColorField label="Color de títulos" value={rule.titleColor} fallback={design.palette.ink} onChange={(titleColor) => set({ titleColor })} />
            <ColorField label="Color de textos" value={rule.textColor} fallback={design.palette.muted} onChange={(textColor) => set({ textColor })} />
            <ColorField label="Color de acento" text="Botones, enlaces y detalles" value={rule.accentColor} fallback={design.palette.accent} onChange={(accentColor) => set({ accentColor })} />
          </div>
        </Group>

        <Group title="Tipografía y tamaños" text="Letra, tamaños, grosor, interlineado y espaciado" badge={changed(["titleFont", "textFont", "title", "subtitle", "text_size", "titleWeight", "textWeight", "titleLeading", "textLeading", "titleTracking", "textTracking", "titleUpper", "titleItalic"])}>
          <div className="grid gap-3 sm:grid-cols-2">
            <RoleField label="Títulos con" value={rule.titleFont} fallback="heading" onChange={(titleFont) => set({ titleFont })} />
            <RoleField label="Textos con" value={rule.textFont} fallback="text" onChange={(textFont) => set({ textFont })} />
          </div>
          {([["title", "Títulos"], ["subtitle", "Subtítulos"], ["text_size", "Párrafos"]] as const).map(([key, label]) => (
            <ScaleField
              key={key}
              label={label}
              value={rule[key] ?? (key === "text_size" ? design.sizes.text : design.sizes[key])}
              inherited={rule[key] === undefined}
              onChange={(value) => set({ [key]: value })}
              onReset={() => set({ [key]: undefined })}
            />
          ))}
          <TypeFields rule={rule} set={set} from="la web" />
        </Group>

        {design.pages[page.key] && (
          <button type="button" onClick={() => draft.setPage(page.key, null)} className="text-xs font-semibold text-red-700">
            Quitar todos los ajustes de esta página
          </button>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink">Secciones</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">Elige una aquí o haz clic sobre ella en la vista previa.</p>
        {sections.length ? (
          <ul className="mt-3 grid gap-1.5">
            {sections.map((item) => {
              const own = rule.sections?.[item.key];
              return (
                <li key={item.key}>
                  <button type="button" onClick={() => onSection(item.key)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-sm transition hover:border-ink/30">
                    <span className={`min-w-0 truncate font-medium ${own?.hidden ? "text-muted line-through" : "text-ink"}`}>{item.label}</span>
                    <span className="shrink-0 text-[11px] text-muted">{own ? (own.hidden ? "Oculta" : "Personalizada") : "Editar"} →</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs text-muted">Cargando las secciones de la vista previa…</p>
        )}
      </section>
    </div>
  );
}

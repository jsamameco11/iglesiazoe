import type { ArtSpec, DesignPage } from "@/lib/design";
import { ColorField, Toggle } from "./fields";
import type { Draft } from "./use-draft";

const speeds = [
  { value: 0.5, label: "Lenta" },
  { value: 1, label: "Normal" },
  { value: 1.5, label: "Rápida" },
];

export function ArtPanel({ draft, specs, pages, onShow }: { draft: Draft; specs: ArtSpec[]; pages: DesignPage[]; onShow: (page: string) => void }) {
  const { design } = draft;

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-muted">Dibujos y animaciones de la web. Cambia sus colores, su velocidad, déjalos quietos u ocúltalos.</p>
      {specs.map((spec) => {
        const rule = design.art[spec.key] ?? {};
        const speed = rule.speed ?? 1;
        const page = pages.find((item) => item.key === spec.page);
        const set = (patch: Parameters<Draft["setArt"]>[1]) => draft.setArt(spec.key, patch);
        return (
          <article key={spec.key} className="rounded-2xl border border-line bg-white/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">{spec.label}</h3>
                <p className="mt-0.5 text-xs leading-5 text-muted">{spec.text}</p>
              </div>
              {page?.url && (
                <button type="button" onClick={() => onShow(page.key)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold hover:border-ink/30">
                  Ver en {page.label}
                </button>
              )}
            </div>

            {spec.colors.length > 0 && (
              <div className="mt-3 grid gap-2">
                {spec.colors.map((color) => (
                  <ColorField
                    key={color.key}
                    label={color.label}
                    text={color.value ? "Original" : "Igual que el acento"}
                    value={rule.colors?.[color.key]}
                    fallback={color.value || design.palette.accent}
                    onChange={(value) => set({ colors: { ...(rule.colors ?? {}), [color.key]: value } })}
                  />
                ))}
              </div>
            )}

            <div className="mt-3">
              <p className="text-xs font-semibold text-muted">Velocidad</p>
              <div className="mt-1.5 flex rounded-full border border-line bg-white p-1">
                {speeds.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={rule.still}
                    onClick={() => set({ speed: option.value })}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${speed === option.value ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <Toggle label="Sin movimiento" text="Se queda quieta en su forma final." checked={Boolean(rule.still)} onChange={(still) => set({ still })} />
              {spec.canHide && <Toggle label="Ocultar" text="No se muestra en la web." checked={Boolean(rule.hidden)} onChange={(hidden) => set({ hidden })} />}
            </div>

            {design.art[spec.key] && (
              <button type="button" onClick={() => draft.setArt(spec.key, null)} className="mt-3 text-xs font-semibold text-red-700">
                Volver al original
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

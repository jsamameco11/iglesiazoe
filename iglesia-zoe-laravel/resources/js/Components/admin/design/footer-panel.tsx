import { usePage } from "@inertiajs/react";
import { useActionState, useState } from "react";
import { blankDefaults, CopyFields, type CopyGroup } from "@/Components/admin/copy-fields";
import { can, usePanelUser } from "@/lib/access";
import { saveTexts, send, type ActionResult } from "@/lib/actions";
import { copyGroups } from "@/lib/copy";
import { footerAlign, hex, readableInk, resolvePalette, type FooterLogo, type FooterPart, type TextAlign } from "@/lib/design";
import type { SiteSettings } from "@/lib/types";
import { Choice, ColorField, Group, RangeField } from "./fields";
import type { Draft } from "./use-draft";

const places: { key: FooterLogo | "none"; label: string }[] = [
  { key: "none", label: "Sin logo" },
  { key: "above", label: "Encima del nombre" },
  { key: "beside", label: "Al lado del nombre" },
  { key: "only", label: "Solo el logo" },
  { key: "center", label: "Centrado arriba" },
  { key: "bottom", label: "En la franja final" },
];

const parts: { key: FooterPart; label: string; text: string }[] = [
  { key: "brand", label: "Nombre de la iglesia", text: "IGLESIA ZOE, siempre en mayúsculas y más grande que el resto" },
  { key: "slogan", label: "Eslogan", text: "La frase grande; los íconos de redes siguen su alineación" },
  { key: "titles", label: "Títulos de columnas", text: "Conoce, Siguiente paso y Visítanos" },
  { key: "links", label: "Enlaces y datos", text: "Páginas, dirección, horarios y contacto" },
];

const aligns: { key: TextAlign; label: string }[] = [
  { key: "left", label: "Izquierda" },
  { key: "center", label: "Centro" },
  { key: "right", label: "Derecha" },
];

const percent = (value: number) => `${Math.round(value * 100)} %`;

/** The footer every page shares: logo and its place, background, and color, size and alignment of each kind of text. */
export function FooterPanel({ draft, onSaved }: { draft: Draft; onSaved: () => void }) {
  const user = usePanelUser();
  const rule = draft.design.footer ?? {};
  const palette = resolvePalette(draft.design);
  const background = hex(rule.background, palette.ink);
  const ink = readableInk(background, palette.ink);
  const place = rule.logo ? (rule.logoPlace ?? "none") : "none";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Pie de página</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">Es el mismo en todas las páginas y en las dos propuestas. Toca el pie en la vista previa para volver aquí.</p>
      </div>

      <Group title="Logo" text={rule.logo && rule.logoPlace ? places.find((item) => item.key === rule.logoPlace)?.label : "Sin logo"} open>
        <LogoPicker logo={rule.logo} background={background} onChange={(logo) => draft.setFooter({ logo, logoPlace: logo ? (rule.logoPlace ?? "above") : undefined })} />
        <div>
          <p className="text-xs font-semibold text-muted">Dónde va el logo</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {places.map((option) => {
              const active = place === option.key;
              const locked = option.key !== "none" && !rule.logo;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={locked}
                  onClick={() => draft.setFooter({ logoPlace: option.key === "none" ? undefined : option.key })}
                  title={locked ? "Primero sube el logo" : option.label}
                  className={`rounded-2xl border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
                >
                  <PlaceSketch place={option.key} active={active} />
                  <span className="mt-1.5 block text-[11px] font-semibold leading-tight">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {rule.logo && rule.logoPlace && (
          <RangeField label="Alto del logo" value={rule.logoSize} fallback={56} min={32} max={160} step={2} format={(value) => `${value} px`} onChange={(logoSize) => draft.setFooter({ logoSize })} />
        )}
      </Group>

      <Group title="Fondo" text={rule.background ? rule.background.toUpperCase() : "Oscuro, el color de títulos de la web"} open>
        <ColorField label="Color de fondo del pie" text="Color de títulos de la web" value={rule.background} fallback={palette.ink} onChange={(value) => draft.setFooter({ background: value || undefined })} />
        <p className="text-[11px] leading-4 text-muted">Los textos sin color propio cambian solos a blanco u oscuro para leerse bien sobre el fondo.</p>
      </Group>

      {parts.map((part) => {
        const text = rule[part.key] ?? {};
        const natural = footerAlign({ ...rule, [part.key]: undefined }, part.key);
        return (
          <Group key={part.key} title={part.label} text={part.text} badge={Object.keys(text).length ? "Editado" : undefined}>
            <ColorField label="Color" text="Automático según el fondo" value={text.color} fallback={ink} onChange={(color) => draft.setFooterText(part.key, { color: color || undefined })} />
            <RangeField label="Tamaño" value={text.size} fallback={1} min={0.6} max={1.8} step={0.05} format={percent} onChange={(size) => draft.setFooterText(part.key, { size: size === 1 ? undefined : size })} />
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">Alineación</p>
              <Choice<TextAlign> value={text.align ?? natural} options={aligns} onChange={(align) => draft.setFooterText(part.key, { align: align === natural ? undefined : align })} />
            </div>
            {Object.keys(text).length > 0 && (
              <button type="button" onClick={() => draft.setFooterText(part.key, { color: undefined, size: undefined, align: undefined })} className="text-xs font-semibold text-muted hover:text-ink">
                Volver al original
              </button>
            )}
          </Group>
        );
      })}

      {can(user, "content.manage") && <FooterTexts onSaved={onSaved} />}
    </div>
  );
}

/** Slogan and the footer texts, published on the spot like the rest of the content. */
function FooterTexts({ onSaved }: { onSaved: () => void }) {
  const { settings } = usePage<{ settings: SiteSettings }>().props;
  const group = copyGroups.find((item) => item.id === "footer") as CopyGroup;
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const slogan = await send("/admin/contenido", { footerTagline: String(formData.get("footerTagline") ?? "") });
    if (!slogan.ok) return slogan;
    const result = await saveTexts(blankDefaults(formData, [group]));
    if (result.ok) onSaved();
    return result;
  }, undefined);

  return (
    <Group title="Textos del pie" text="Eslogan, nombre, títulos de columnas y franja final.">
      <form action={action} className="space-y-4">
        <label className="block text-sm">
          Eslogan
          <textarea name="footerTagline" defaultValue={settings.footerTagline} rows={3} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink/40" />
        </label>
        <CopyFields settings={settings} group={group} columns={false} />
        {state?.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Textos publicados.</p>}
        {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Publicando…" : "Publicar textos"}</button>
      </form>
    </Group>
  );
}

function LogoPicker({ logo, background, onChange }: { logo?: string; background: string; onChange: (logo: string | undefined) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError("");
    const result = await send("/admin/diseno/fondo", { file });
    setPending(false);
    if (result.ok && result.kind === "image" && typeof result.src === "string") onChange(result.src);
    else setError(result.ok ? "El logo debe ser una imagen." : result.error || "No se pudo subir el logo.");
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <p className="text-sm font-semibold">Archivo del logo</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted">PNG con fondo transparente o WebP, hasta 12 MB. Se ve sobre el color del pie.</p>
      {logo && (
        <div className="mt-3 grid h-28 place-items-center rounded-xl p-4" style={{ background }}>
          <img src={logo} alt="Logo del pie" className="max-h-20 w-auto max-w-full object-contain" />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={`cursor-pointer rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/85 ${pending ? "pointer-events-none opacity-60" : ""}`}>
          {pending ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}
          <input type="file" accept="image/png,image/webp,image/jpeg,image/avif,image/gif" className="sr-only" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        {logo && <button type="button" onClick={() => onChange(undefined)} className="text-xs font-semibold text-muted hover:text-ink">Quitar</button>}
      </div>
      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
    </div>
  );
}

/** Tiny drawing of the footer with the logo in that place. */
function PlaceSketch({ place, active }: { place: FooterLogo | "none"; active: boolean }) {
  const ink = active ? "bg-white" : "bg-ink/70";
  const soft = active ? "bg-white/35" : "bg-ink/15";
  const mark = <span className={`block h-3 w-3 shrink-0 rounded-[3px] ${active ? "bg-accent" : "bg-accent/80"}`} />;
  const name = <span className={`block h-1.5 w-8 rounded-full ${ink}`} />;
  return (
    <span className={`flex h-12 flex-col justify-between rounded-lg p-1.5 ${active ? "bg-white/10" : "bg-paper"}`}>
      <span className={`flex gap-1 ${place === "above" ? "flex-col items-start" : place === "center" ? "flex-col items-center" : "items-center"}`}>
        {(place === "above" || place === "beside" || place === "only" || place === "center") && mark}
        {place !== "only" && (place === "center" ? <span className="self-start">{name}</span> : name)}
      </span>
      <span className="flex items-center gap-1 border-t border-current/10 pt-1">
        {place === "bottom" && <span className={`block h-2 w-2 rounded-[2px] ${active ? "bg-accent" : "bg-accent/80"}`} />}
        <span className={`block h-1 w-10 rounded-full ${soft}`} />
      </span>
    </span>
  );
}

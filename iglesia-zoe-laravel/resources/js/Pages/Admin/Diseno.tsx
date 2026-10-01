import { Link, router, usePage } from "@inertiajs/react";
import type { SiteSettings } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { Notice, PageHeader, Panel, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { can, usePanelUser } from "@/lib/access";
import { designAttributes, fontStack, resolvePalette, zoePalette, type Design, type FontOption, type PageRule, type Palette } from "@/lib/design";

function baseOf(settings: SiteSettings): Palette {
  return resolvePalette(undefined, settings);
}

const presets: { name: string; palette: Palette }[] = [
  { name: "Zoe", palette: { ...zoePalette } },
  { name: "Arena", palette: { paper: "#f6f1e9", card: "#fffaf2", ink: "#2a2420", muted: "#7d7268", line: "#e8dfd2", accent: "#c45c26", stone: "#eadfce", clay: "#edd4c2" } },
  { name: "Piedra", palette: { paper: "#f4f3f0", card: "#fbfaf7", ink: "#2a2623", muted: "#6f6a64", line: "#e2dfd8", accent: "#c45c26", stone: "#ddd9d1", clay: "#e4d0c4" } },
];

const paletteFields: { key: keyof Palette; label: string; text: string }[] = [
  { key: "accent", label: "Acento", text: "Botones principales y llamadas a la acción" },
  { key: "ink", label: "Carbón", text: "Títulos y franjas de alto impacto" },
  { key: "paper", label: "Marfil", text: "Fondo principal de la web" },
  { key: "muted", label: "Textos", text: "Párrafos y descripciones" },
  { key: "stone", label: "Arena / piedra", text: "Tarjetas y bloques de apoyo" },
  { key: "clay", label: "Terracota", text: "Acentos suaves y secciones cálidas" },
  { key: "card", label: "Tarjetas", text: "Contenedores y formularios" },
  { key: "line", label: "Líneas", text: "Bordes y separadores" },
];

const shapes: { key: Design["shape"]; label: string; radius: string }[] = [
  { key: "round", label: "Redondeadas", radius: "999px" },
  { key: "soft", label: "Suaves", radius: "12px" },
  { key: "square", label: "Rectas", radius: "3px" },
];

type Props = { stored: Design; fonts: FontOption[]; pages: { key: string; label: string }[] };

export default function Diseno({ stored, fonts, pages }: Props) {
  const user = usePanelUser();
  const { settings } = usePage().props as unknown as { settings: SiteSettings };
  const originals = useMemo(() => baseOf(settings), [settings]);
  const [design, setDesign] = useState<Design>(stored);
  const [page, setPage] = useState("");
  const { result, setResult, pending, run } = useAction();
  const dirty = JSON.stringify(design) !== JSON.stringify(stored);

  useEffect(() => {
    const id = "zoe-design-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.bunny.net/css?family=${fonts.map((font) => `${font.slug}:400,500,600`).join("|")}&display=swap`;
    document.head.appendChild(link);
  }, [fonts]);

  const rule: PageRule = page ? design.pages[page] ?? {} : {};
  const setPalette = (key: keyof Palette, value: string) => setDesign((current) => ({ ...current, palette: { ...current.palette, [key]: value } }));
  const setRule = (patch: Partial<PageRule>) =>
    setDesign((current) => {
      const next = { ...(current.pages[page] ?? {}), ...patch };
      (Object.keys(next) as (keyof PageRule)[]).forEach((key) => (next[key] === "" || next[key] === undefined) && delete next[key]);
      const pagesNext = { ...current.pages };
      if (Object.keys(next).length) pagesNext[page] = next;
      else delete pagesNext[page];
      return { ...current, pages: pagesNext };
    });

  function publish() {
    run(() => send("/admin/diseno", { design: JSON.stringify(design) }), () => router.reload());
  }

  function restore() {
    if (!window.confirm("¿Volver al diseño original de la web? Se quitan colores, tipografías y tamaños personalizados.")) return;
    run(() => send("/admin/diseno/restaurar", {}));
  }

  return (
    <AdminLayout>
      <div className="pb-24">
        <PageHeader
          kicker="Página web"
          title="Diseño de la página"
          text="Cambia la paleta de colores, las tipografías, los colores y tamaños de texto y las formas. Primero en toda la web y, si quieres, página por página. Al publicar, todos los visitantes lo ven."
          aside={
            <div className="flex flex-wrap gap-2">
              <a href="/" target="_blank" rel="noreferrer" className={ghost}>Ver la web ↗</a>
              <button type="button" onClick={restore} className={ghost}>Restaurar original</button>
            </div>
          }
        />

        <div className="mt-7 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Panel title="Paleta de colores" text="Estos colores se aplican a botones, fondos, tarjetas y franjas. Elige una combinación o ajusta cada tono.">
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => {
                  const active = JSON.stringify(preset.palette) === JSON.stringify(design.palette);
                  return (
                    <button key={preset.name} type="button" onClick={() => setDesign((current) => ({ ...current, palette: preset.palette }))} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}>
                      <span className="flex -space-x-1">
                        {(["paper", "ink", "accent"] as const).map((key) => <span key={key} className="h-4 w-4 rounded-full border border-white" style={{ background: preset.palette[key] || originals[key] }} />)}
                      </span>
                      {preset.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {paletteFields.map((field) => (
                  <ColorField key={field.key} label={field.label} text={field.text} value={design.palette[field.key]} fallback={originals[field.key]} onChange={(value) => setPalette(field.key, value)} />
                ))}
              </div>
            </Panel>

            <Panel title="Tipografías" text="Los títulos usan la tipografía de títulos; párrafos, botones y menús usan la de textos.">
              <div className="grid gap-4 md:grid-cols-2">
                <FontField label="Títulos" value={design.fonts.heading} fonts={fonts} sample="Una familia que se reúne cada semana" onChange={(value) => setDesign((current) => ({ ...current, fonts: { ...current.fonts, heading: value } }))} />
                <FontField label="Textos" value={design.fonts.text} fonts={fonts} sample="Somos creyentes de Jesús y embajadores de él." onChange={(value) => setDesign((current) => ({ ...current, fonts: { ...current.fonts, text: value } }))} />
              </div>
            </Panel>

            <Panel title="Tamaños de texto" text="100 % es el tamaño original. Afecta a toda la web.">
              <div className="grid gap-5 md:grid-cols-3">
                {(["title", "subtitle", "text"] as const).map((key) => (
                  <ScaleField key={key} label={{ title: "Títulos", subtitle: "Subtítulos", text: "Párrafos" }[key]} value={design.sizes[key]} onChange={(value) => setDesign((current) => ({ ...current, sizes: { ...current.sizes, [key]: value } }))} />
                ))}
              </div>
            </Panel>

            <Panel title="Formas" text="Esquinas de botones, tarjetas e imágenes.">
              <div className="grid gap-3 sm:grid-cols-3">
                {shapes.map((shape) => (
                  <button key={shape.key} type="button" onClick={() => setDesign((current) => ({ ...current, shape: shape.key }))} className={`rounded-2xl border p-4 text-left transition ${design.shape === shape.key ? "border-ink ring-4 ring-ink/5" : "border-line bg-white hover:border-ink/30"}`}>
                    <span className="flex items-center gap-2">
                      <span className="h-8 w-16 bg-ink" style={{ borderRadius: shape.radius }} />
                      <span className="h-8 w-8 border-2 border-ink/30" style={{ borderRadius: shape.key === "round" ? "14px" : shape.radius }} />
                    </span>
                    <span className="mt-3 block text-sm font-semibold">{shape.label}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Página por página" text="Ajustes que solo aplican a una página. Lo que dejes en «Igual que la web» usa la configuración general.">
              <div className="flex flex-wrap gap-2">
                {pages.map((item) => (
                  <button key={item.key} type="button" onClick={() => setPage(page === item.key ? "" : item.key)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${page === item.key ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}>
                    {item.label}{design.pages[item.key] ? " •" : ""}
                  </button>
                ))}
              </div>
              {page ? (
                <div className="mt-5 space-y-5 rounded-2xl border border-line bg-white p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-semibold text-muted">Tipografía de títulos
                      <select value={rule.heading ?? ""} onChange={(event) => setRule({ heading: event.target.value })} className={input}>
                        <option value="">Igual que la web ({design.fonts.heading})</option>
                        {fonts.map((font) => <option key={font.name} value={font.name}>{font.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-muted">Tipografía de textos
                      <select value={rule.text ?? ""} onChange={(event) => setRule({ text: event.target.value })} className={input}>
                        <option value="">Igual que la web ({design.fonts.text})</option>
                        {fonts.map((font) => <option key={font.name} value={font.name}>{font.name}</option>)}
                      </select>
                    </label>
                    <ColorField label="Color de títulos" text="Solo en esta página" value={rule.titleColor ?? ""} fallback={design.palette.ink || originals.ink} onChange={(value) => setRule({ titleColor: value })} />
                    <ColorField label="Color de textos" text="Solo en esta página" value={rule.textColor ?? ""} fallback={design.palette.muted || originals.muted} onChange={(value) => setRule({ textColor: value })} />
                  </div>
                  <div className="grid gap-5 md:grid-cols-3">
                    {([["title", "Títulos"], ["subtitle", "Subtítulos"], ["text_size", "Párrafos"]] as const).map(([key, label]) => (
                      <ScaleField key={key} label={label} value={rule[key] ?? (key === "text_size" ? design.sizes.text : design.sizes[key])} inherited={rule[key] === undefined} onChange={(value) => setRule({ [key]: value })} onReset={() => setRule({ [key]: undefined })} />
                    ))}
                  </div>
                  <button type="button" onClick={() => setDesign((current) => { const next = { ...current.pages }; delete next[page]; return { ...current, pages: next }; })} className="text-xs font-semibold text-red-700">Quitar ajustes de esta página</button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">Elige una página para personalizarla.</p>
              )}
            </Panel>

            {(can(user, "media.manage") || can(user, "content.manage")) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {can(user, "media.manage") && <Link href="/admin/medios" className="rounded-2xl border border-line bg-white p-5 transition hover:border-ink/30"><p className="text-sm font-semibold">Imágenes y videos →</p><p className="mt-1 text-xs text-muted">Cambia fotos, videos y la cantidad de imágenes de la galería.</p></Link>}
                {can(user, "content.manage") && <Link href="/admin/contenido" className="rounded-2xl border border-line bg-white p-5 transition hover:border-ink/30"><p className="text-sm font-semibold">Textos de la web →</p><p className="mt-1 text-xs text-muted">Títulos, párrafos, horarios y botones de cada página.</p></Link>}
              </div>
            )}
          </div>

          <div className="2xl:sticky 2xl:top-8 2xl:self-start">
            <Preview design={design} base={originals} page={page} pageLabel={pages.find((item) => item.key === page)?.label} />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-5 py-3 backdrop-blur md:left-[272px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><Notice result={result} onClose={() => setResult(null)} />{!result && <p className="text-sm text-muted">{dirty ? "Tienes cambios sin publicar." : "Todo publicado."}</p>}</div>
            <div className="flex gap-2">
              {dirty && <button type="button" onClick={() => setDesign(stored)} className={ghost}>Descartar</button>}
              <button type="button" onClick={publish} disabled={pending || !dirty} className={button}>{pending ? "Publicando…" : "Publicar en la web"}</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function ColorField({ label, text, value, fallback, onChange }: { label: string; text: string; value: string; fallback: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
      <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-black/10" style={{ background: value || fallback }}>
        <input type="color" value={value || fallback} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-[11px] text-muted">{value ? value.toUpperCase() : `Original · ${text}`}</p>
      </div>
      {value && <button type="button" onClick={() => onChange("")} className="text-[11px] font-semibold text-muted hover:text-ink">Original</button>}
    </div>
  );
}

function FontField({ label, value, fonts, sample, onChange }: { label: string; value: string; fonts: FontOption[]; sample: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <label className="text-xs font-semibold text-muted">{label}
        <select value={value} onChange={(event) => onChange(event.target.value)} className={input}>
          <optgroup label="Sans">{fonts.filter((font) => font.kind === "sans").map((font) => <option key={font.name}>{font.name}</option>)}</optgroup>
          <optgroup label="Serif">{fonts.filter((font) => font.kind === "serif").map((font) => <option key={font.name}>{font.name}</option>)}</optgroup>
        </select>
      </label>
      <p className="mt-4 text-2xl leading-tight" style={{ fontFamily: fontStack(value, fonts) }}>{sample}</p>
    </div>
  );
}

function ScaleField({ label, value, onChange, inherited, onReset }: { label: string; value: number; onChange: (value: number) => void; inherited?: boolean; onReset?: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {Math.round(value * 100)} %{inherited ? " · igual que la web" : ""}
          {!inherited && onReset && <button type="button" onClick={onReset} className="font-semibold hover:text-ink">×</button>}
        </span>
      </div>
      <input type="range" min={0.75} max={1.4} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-ink" />
      <div className="flex justify-between text-[10px] text-muted"><span>75 %</span><span>100 %</span><span>140 %</span></div>
    </div>
  );
}

function Preview({ design, base, page, pageLabel }: { design: Design; base: Palette; page: string; pageLabel?: string }) {
  const { style } = useMemo(() => designAttributes(design, page || undefined, base), [design, base, page]);
  const rule = (page && design.pages[page]) || {};
  const paper = style["--paper"];
  const accent = style["--accent"];
  const ink = style["--ink"];
  const tone = {
    "--paper": paper,
    "--ink": ink,
    "--muted": style["--muted"],
    "--zoe-accent": accent,
    "--zoe-accent-deep": `color-mix(in srgb, ${accent} 42%, ${ink})`,
    "--card": style["--card"] || `color-mix(in srgb, #fff 70%, ${paper})`,
    "--line": style["--line"] || `color-mix(in srgb, ${ink} 11%, ${paper})`,
    "--font-heading": style["--font-heading"],
    "--font-text": style["--font-text"],
  };
  const scale = (key: "title" | "subtitle" | "text_size") => (rule[key] ?? (key === "text_size" ? design.sizes.text : design.sizes[key]));
  const radius = { round: "999px", soft: "12px", square: "3px" }[design.shape];
  const cardRadius = { round: "22px", soft: "12px", square: "3px" }[design.shape];

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-line bg-white shadow-[0_24px_60px_-40px_rgba(42,39,36,0.45)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[11px] text-muted">
        <span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e8a598]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ecd08f]" /><span className="h-2.5 w-2.5 rounded-full bg-[#a9cf9c]" /></span>
        <span>Vista previa · {pageLabel || "Toda la web"}</span>
      </div>
      <div style={{ ...tone, background: "var(--paper)", color: "var(--muted)" } as React.CSSProperties} className="p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--zoe-accent, #c47a45)", fontFamily: "var(--font-text)" }}>Iglesia Zoe</p>
        <h3 className="mt-3 leading-[1.02]" style={{ fontFamily: "var(--font-heading)", color: "var(--ink, #1a1a1a)", fontSize: `${2.1 * scale("title")}rem`, fontWeight: 500 }}>Tu iglesia local, donde Dios se manifiesta en amor</h3>
        <p className="mt-3 leading-6" style={{ fontFamily: "var(--font-text)", fontSize: `${0.9 * scale("text_size")}rem` }}>Somos creyentes de Jesús y embajadores de él. Ven y forma parte de un reino que vive en abundancia.</p>
        <div className="mt-5 flex gap-2" style={{ fontFamily: "var(--font-text)" }}>
          <span className="px-4 py-2 text-xs font-semibold text-white" style={{ background: "var(--accent)", borderRadius: radius }}>Planifica tu visita</span>
          <span className="border px-4 py-2 text-xs font-semibold" style={{ borderColor: "var(--zoe-accent, #c47a45)", color: "var(--zoe-accent-deep, #8d5430)", borderRadius: radius }}>Prédicas</span>
        </div>
        <div className="mt-6 border p-4" style={{ background: "var(--card, #fffcf8)", borderColor: "var(--line, #e6e2db)", borderRadius: cardRadius }}>
          <p style={{ fontFamily: "var(--font-heading)", color: "var(--ink, #1a1a1a)", fontSize: `${1.25 * scale("subtitle")}rem`, fontWeight: 500 }}>Zoe Young</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-text)", fontSize: `${0.78 * scale("text_size")}rem` }}>Jóvenes y universitarios. Un espacio para conectar y crecer juntos.</p>
        </div>
      </div>
    </div>
  );
}

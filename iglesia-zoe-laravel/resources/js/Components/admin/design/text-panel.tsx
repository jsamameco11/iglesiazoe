import { fontRoles, fontStack, type DesignPage, type FontCategory, type FontOption, type FontRole, type TextAlign, type TextPick, type TextRule } from "@/lib/design";
import { RangeField, SelectField, Toggle, percent } from "./fields";
import { FontPicker } from "./font-picker";
import type { Draft } from "./use-draft";

const kinds: Record<string, string> = {
  h1: "Título principal",
  h2: "Título",
  h3: "Subtítulo",
  h4: "Subtítulo",
  h5: "Subtítulo",
  h6: "Subtítulo",
  p: "Párrafo",
  a: "Enlace o botón",
  button: "Botón",
  li: "Elemento de lista",
  label: "Etiqueta",
  blockquote: "Cita",
  figcaption: "Pie de foto",
};

const weights = [
  { value: 300, label: "Ligera" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Media" },
  { value: 600, label: "Seminegrita" },
  { value: 700, label: "Negrita" },
  { value: 800, label: "Extra negrita" },
  { value: 900, label: "Black" },
];

const aligns: { key: TextAlign | undefined; label: string; lines: string[] }[] = [
  { key: undefined, label: "Original", lines: [] },
  { key: "left", label: "Izquierda", lines: ["M3 5h14", "M3 9h9", "M3 13h14", "M3 17h7"] },
  { key: "center", label: "Centro", lines: ["M3 5h14", "M5.5 9h9", "M3 13h14", "M6.5 17h7"] },
  { key: "right", label: "Derecha", lines: ["M3 5h14", "M8 9h9", "M3 13h14", "M10 17h7"] },
];

/** An inline text (a link, a word) needs its own line to be aligned; flex and grid boxes stay so their insides keep their layout. */
function boxFor(display: string): TextRule["box"] {
  if (!display.startsWith("inline")) return undefined;
  return display === "inline-flex" ? "flex" : display === "inline-grid" ? "grid" : "block";
}

function fontOf(rule: TextRule | undefined, roles: Record<FontRole, FontOption>): FontOption | undefined {
  if (!rule?.font) return undefined;
  return typeof rule.font === "string" ? roles[rule.font] : rule.font;
}

function summary(rule: TextRule, roles: Record<FontRole, FontOption>) {
  return [
    fontOf(rule, roles)?.name,
    rule.size ? percent(rule.size) : "",
    rule.align ? aligns.find((align) => align.key === rule.align)?.label : "",
    rule.weight ? weights.find((weight) => weight.value === rule.weight)?.label : "",
    rule.italic ? "Cursiva" : "",
  ].filter(Boolean);
}

function Step({ number, title, text, active, done }: { number: number; title: string; text: string; active: boolean; done: boolean }) {
  return (
    <li className={`flex gap-3 rounded-2xl border p-3 transition ${active ? "border-accent/40 bg-accent/[0.06]" : "border-line bg-white"}`}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-accent text-white" : "bg-stone text-muted"}`}>{done ? "✓" : number}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-[11px] leading-4 text-muted">{text}</span>
      </span>
    </li>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-line pt-4">
      <div>
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {hint && <p className="text-[11px] leading-4 text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Restyles single texts of the page: pick one in the preview, then change its letter, size and alignment. */
export function TextPanel({
  draft,
  page,
  fonts,
  categories,
  pick,
  onPick,
}: {
  draft: Draft;
  page: DesignPage;
  fonts: FontOption[];
  categories: FontCategory[];
  pick: TextPick | null;
  onPick: (pick: TextPick | null) => void;
}) {
  const roles = draft.design.fonts;
  const texts = draft.design.pages[page.key]?.texts ?? {};
  const styled = Object.entries(texts);
  const rule = pick ? texts[pick.path] ?? {} : {};
  const sample = pick?.label ? (pick.label.length > 34 ? `${pick.label.slice(0, 34)}…` : pick.label) : "Vida en abundancia";
  const current = fontOf(rule, roles);

  const set = (patch: Partial<TextRule>) => pick && draft.setText(page.key, pick.path, { ...patch, label: pick.label || rule.label });
  const align = (key: TextAlign | undefined) => set({ align: key, box: key ? rule.box ?? boxFor(pick?.display ?? "") : undefined });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">Un texto con estilo propio</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Por defecto cada texto usa las tres tipografías de la web y se ve tal cual la página. Aquí le das a un texto concreto otra letra, otro tamaño u otra alineación. El cambio vale solo en <strong className="font-semibold text-ink">{page.label}</strong>.
        </p>
      </div>

      <ol className="space-y-2">
        <Step number={1} title="Toca un texto en la vista previa" text="Al pasar el mouse se marca con una línea azul. Los que ya tienen estilo propio llevan una línea punteada naranja." active={!pick} done={Boolean(pick)} />
        <Step number={2} title="Ajústalo aquí" text="Tipografía, tamaño, alineación, grosor y cursiva. Lo ves al instante." active={Boolean(pick)} done={false} />
        <Step number={3} title="Publica" text="Nada cambia para los visitantes hasta que pulses «Publicar en la web»." active={draft.dirty} done={false} />
      </ol>

      {pick ? (
        <div className="space-y-4 rounded-[1.4rem] border border-ink/15 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(42,39,36,0.6)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{kinds[pick.tag] ?? "Texto"} elegido</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink">“{pick.label || "Texto sin palabras"}”</p>
            </div>
            <button type="button" onClick={() => onPick(null)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-ink/30">Elegir otro</button>
          </div>

          <Section title="Tipografía" hint="«Original» deja la letra que la página ya usa. Las tres de la web siguen a lo que elijas en «Toda la web».">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => set({ font: undefined })}
                className={`rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition ${!rule.font ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
              >
                Original
                <span className={`block text-[10px] font-normal ${!rule.font ? "text-white/70" : "text-muted"}`}>Tal cual la página</span>
              </button>
              {fontRoles.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => set({ font: role.key })}
                  className={`rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition ${rule.font === role.key ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
                >
                  <span className="block truncate text-sm" style={{ fontFamily: fontStack(roles[role.key]) }}>{roles[role.key].name}</span>
                  <span className={`block text-[10px] font-normal ${rule.font === role.key ? "text-white/70" : "text-muted"}`}>La de {role.label.toLowerCase()}</span>
                </button>
              ))}
            </div>
            <FontPicker
              fonts={fonts}
              categories={categories}
              current={typeof rule.font === "object" ? current : undefined}
              caption={typeof rule.font === "object" ? undefined : "O elige del repertorio"}
              sample={sample}
              onPick={(font) => set({ font })}
            />
          </Section>

          <Section title="Tamaño" hint="100 % es el tamaño original. Se adapta solo a celular y tableta.">
            <RangeField label="Tamaño de la letra" value={rule.size} fallback={1} min={0.5} max={2.5} step={0.05} format={percent} onChange={(size) => set({ size: size === 1 ? undefined : size })} />
            <div className="flex gap-1.5">
              {[0.8, 1.2, 1.5, 2].map((size) => (
                <button key={size} type="button" onClick={() => set({ size })} className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${rule.size === size ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink/30 hover:text-ink"}`}>
                  {percent(size)}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Alineación" hint="Mueve el texto a la izquierda, al centro o a la derecha de su espacio.">
            <div className="grid grid-cols-4 gap-1.5">
              {aligns.map((item) => {
                const active = rule.align === item.key;
                return (
                  <button key={item.label} type="button" onClick={() => align(item.key)} aria-pressed={active} className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-semibold transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink/30 hover:text-ink"}`}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                      {item.lines.length ? item.lines.map((line) => <path key={line} d={line} />) : <path d="M4 10a6 6 0 1 0 2-4.5M4 4v3h3" />}
                    </svg>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Grosor y estilo">
            <SelectField<number> label="Grosor" value={rule.weight} options={weights} placeholder="Original" onChange={(weight) => set({ weight })} />
            <Toggle label="Cursiva" text="Letra inclinada, buena para frases y citas." checked={Boolean(rule.italic)} onChange={(italic) => set({ italic })} />
          </Section>

          {texts[pick.path] && (
            <button type="button" onClick={() => draft.setText(page.key, pick.path, null)} className="w-full rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-300 hover:text-red-700">
              Quitar el estilo de este texto
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-[1.4rem] border-2 border-dashed border-line bg-paper/40 px-5 py-6 text-center">
          <svg viewBox="0 0 24 24" className="mx-auto h-8 w-8 text-accent" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.8a5 5 0 0 1-3.9-1.9L4.6 15.6a1.6 1.6 0 0 1 2.3-2.2L9 15" />
          </svg>
          <p className="mt-2 text-sm font-semibold text-ink">Toca cualquier texto de la vista previa</p>
          <p className="mt-1 text-xs leading-5 text-muted">Un título, un párrafo, un botón o una etiqueta. Al elegirlo aparecen aquí sus opciones.</p>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-ink">Textos con estilo propio en esta página <span className="font-normal text-muted">({styled.length})</span></h4>
        {styled.length ? (
          <ul className="mt-2 space-y-1.5">
            {styled.map(([path, item]) => (
              <li key={path} className={`flex items-center gap-2 rounded-2xl border p-2.5 transition ${pick?.path === path ? "border-ink bg-ink/[0.03]" : "border-line bg-white"}`}>
                <button type="button" onClick={() => onPick({ path, label: item.label ?? "", tag: "", display: "" })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-ink">{item.label || "Texto"}</span>
                  <span className="block truncate text-[11px] text-muted">{summary(item, roles).join(" · ")}</span>
                </button>
                <button type="button" onClick={() => draft.setText(page.key, path, null)} className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-muted hover:text-red-700" aria-label={`Quitar el estilo de ${item.label || "este texto"}`}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">Todavía ninguno: todos los textos se ven como en la página original.</p>
        )}
      </div>
    </div>
  );
}

import { fontRoles, type FontRole } from "@/lib/design";

export function ColorField({ label, text, value, fallback, onChange }: { label: string; text?: string; value?: string; fallback: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2.5">
      <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-black/10" style={{ background: value || fallback }}>
        <input type="color" value={value || fallback} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="truncate text-[11px] text-muted">{value ? value.toUpperCase() : text ?? "Igual que la web"}</p>
      </div>
      {value && <button type="button" onClick={() => onChange("")} className="shrink-0 text-[11px] font-semibold text-muted hover:text-ink">Quitar</button>}
    </div>
  );
}

export function ScaleField({ label, value, inherited, onChange, onReset }: { label: string; value: number; inherited?: boolean; onChange: (value: number) => void; onReset?: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2 text-xs text-muted">
          {Math.round(value * 100)} %{inherited ? " · igual que la web" : ""}
          {!inherited && onReset && <button type="button" onClick={onReset} className="font-semibold hover:text-ink" aria-label={`Quitar ${label}`}>×</button>}
        </span>
      </div>
      <input type="range" min={0.75} max={1.4} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-ink" />
    </div>
  );
}

export function Choice<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex rounded-full border border-line bg-white p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${value === option.key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Picks which of the three site typefaces a page or section uses for a kind of text. */
export function RoleField({ label, value, fallback, from = "la web", onChange }: { label: string; value?: FontRole; fallback: FontRole; from?: string; onChange: (value: FontRole | undefined) => void }) {
  const base = fontRoles.find((role) => role.key === fallback)?.label;
  return (
    <label className="block text-xs font-semibold text-muted">
      {label}
      <select value={value ?? ""} onChange={(event) => onChange((event.target.value || undefined) as FontRole | undefined)} className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40">
        <option value="">Igual que {from} ({base})</option>
        {fontRoles.map((role) => (
          <option key={role.key} value={role.key}>Tipografía de {role.label.toLowerCase()}</option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ label, text, checked, onChange }: { label: string; text?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-line bg-white p-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {text && <span className="mt-0.5 block text-[11px] leading-4 text-muted">{text}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-ink" />
    </label>
  );
}

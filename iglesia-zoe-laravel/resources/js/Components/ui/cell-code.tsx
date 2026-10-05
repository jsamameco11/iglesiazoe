export type CellLevel = "red" | "servidor" | "hijo" | "subhijo";

/** Background of the number each tier adds in front of its parent's code; the same in every page. */
const CODE_TONES = {
  hijo: "bg-accent text-white",
  subhijo: "bg-clay-deep text-white",
} as const;

const DEPTH: Record<CellLevel, number> = { red: 0, servidor: 0, hijo: 1, subhijo: 2 };

/**
 * 020101H → subhijo 02 of hijo 01 of Servidor Base 01H (Red H). Each tier
 * prefixes two digits to its parent's code; the level, when known, wins over
 * the length of the code.
 */
function splitCellCode(code: string, level?: CellLevel | null) {
  const [, digits = "", letters = ""] = /^(\d*)(.*)$/.exec(code.trim()) ?? [];
  const wanted = level ? DEPTH[level] : digits.length >= 6 ? 2 : digits.length >= 4 ? 1 : 0;
  const depth = Math.min(wanted, Math.max(0, Math.floor((digits.length - 2) / 2)));
  const subhijo = depth === 2 ? digits.slice(0, 2) : null;
  const hijo = depth >= 1 ? digits.slice(depth === 2 ? 2 : 0, depth === 2 ? 4 : 2) : null;
  return { subhijo, hijo, base: digits.slice(depth * 2) + letters };
}

function describe(code: string, parts: ReturnType<typeof splitCellCode>) {
  if (parts.subhijo) return `Servidor subhijo ${parts.subhijo} · del hijo ${parts.hijo} · del Servidor Base ${parts.base}`;
  if (parts.hijo) return `Servidor hijo ${parts.hijo} · del Servidor Base ${parts.base}`;
  return /^\d/.test(code) ? `Servidor Base ${code}` : `Célula del Servidor de Red ${code}`;
}

/** A cell code with the hijo and subhijo numbers set on their own colors. */
export function CellCode({ code, level, className = "" }: { code: string | null | undefined; level?: CellLevel | null; className?: string }) {
  if (!code) return <span className={className}>—</span>;
  const parts = splitCellCode(code, level);
  const chip = "rounded-[0.38em] px-[0.32em] py-[0.04em] leading-[1.25]";
  return (
    <span className={`inline-flex items-center gap-[0.16em] font-semibold tabular-nums whitespace-nowrap ${className}`} title={describe(code, parts)}>
      {parts.subhijo && <span className={`${chip} ${CODE_TONES.subhijo}`}>{parts.subhijo}</span>}
      {parts.hijo && <span className={`${chip} ${CODE_TONES.hijo}`}>{parts.hijo}</span>}
      <span>{parts.base}</span>
    </span>
  );
}

/** How to read a code: one example per tier, with the colors used everywhere. */
export function CellCodeLegend({ network = "H", className = "" }: { network?: string; className?: string }) {
  const steps: { label: string; code: string; level: CellLevel }[] = [
    { label: "Servidor de Red", code: network, level: "red" },
    { label: "Servidor Base", code: `01${network}`, level: "servidor" },
    { label: "Servidor hijo", code: `0101${network}`, level: "hijo" },
    { label: "Servidor subhijo", code: `020101${network}`, level: "subhijo" },
  ];
  return (
    <ol className={`flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl border border-line bg-white px-4 py-3 ${className}`}>
      {steps.map((step, index) => (
        <li key={step.level} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted" aria-hidden="true">→</span>}
          <span className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{step.label}</span>
            <CellCode code={step.code} level={step.level} className="text-sm text-ink" />
          </span>
        </li>
      ))}
    </ol>
  );
}

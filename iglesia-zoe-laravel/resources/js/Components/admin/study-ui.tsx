import { input } from "@/Components/admin/ui";
import type { LevelOption } from "@/lib/studies";

export const STUDY_KICKER = "Estudios · Ruta del Servidor";

export function LevelSelect({ levels, value, name = "study_level_id", label = "Nivel", allLabel = "Todos los niveles" }: { levels: LevelOption[]; value?: string | null; name?: string; label?: string; allLabel?: string | null }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <select name={name} defaultValue={value ?? ""} className={input}>
        {allLabel !== null ? <option value="">{allLabel}</option> : null}
        {levels.map((level) => (
          <option key={level.id} value={level.id}>{level.name}</option>
        ))}
      </select>
    </label>
  );
}

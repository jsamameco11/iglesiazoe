import { Chip, Field } from "@/Components/games/ui";
import { DIFFICULTY_LABEL, type Theme } from "@/lib/games";

export type RebetSettings = { categories: string[]; difficulty: string; count: number };

/** Themes, difficulty and length of a REBET game; shared by solo, turns and live rooms. */
export function RebetSetup({
  themes,
  counts,
  value,
  onChange,
}: {
  themes: Theme[];
  counts: number[];
  value: RebetSettings;
  onChange: (next: RebetSettings) => void;
}) {
  const toggle = (id: string) =>
    onChange({ ...value, categories: value.categories.includes(id) ? value.categories.filter((item) => item !== id) : [...value.categories, id] });

  return (
    <div className="grid gap-8">
      <Field label="Temas" hint="Elige uno o varios. Sin elegir ninguno, las preguntas salen de todos los temas.">
        <div className="flex flex-wrap gap-2">
          <Chip active={value.categories.length === 0} onClick={() => onChange({ ...value, categories: [] })}>Todos</Chip>
          {themes.map((theme) => (
            <Chip key={theme.id} active={value.categories.includes(theme.id)} onClick={() => toggle(theme.id)}>
              {theme.name}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid gap-8 md:grid-cols-2">
        <Field label="Dificultad">
          <div className="flex flex-wrap gap-2">
            {["mixed", "easy", "medium", "hard", "expert"].map((level) => (
              <Chip key={level} active={value.difficulty === level} onClick={() => onChange({ ...value, difficulty: level })}>
                {DIFFICULTY_LABEL[level]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Preguntas">
          <div className="flex flex-wrap gap-2">
            {counts.map((count) => (
              <Chip key={count} active={value.count === count} onClick={() => onChange({ ...value, count })}>
                {count}
              </Chip>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

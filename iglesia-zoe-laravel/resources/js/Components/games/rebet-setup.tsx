import { Avatar, Chip, Field, field } from "@/Components/games/ui";
import { DIFFICULTY_LABEL, type Theme } from "@/lib/games";

export type RebetSettings = { categories: string[]; difficulty: string; count: number };

const LEVELS = ["mixed", "easy", "medium", "hard", "expert"];

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
      <div className="grid gap-8 md:grid-cols-2">
        <Field label="Dificultad">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((level) => (
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
      <Field label="Temas" hint="Elige uno o varios. Sin elegir ninguno, las preguntas salen de todos los temas.">
        <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto pr-1">
          <Chip active={value.categories.length === 0} onClick={() => onChange({ ...value, categories: [] })}>
            Todos
          </Chip>
          {themes.map((theme) => (
            <Chip key={theme.id} active={value.categories.includes(theme.id)} onClick={() => toggle(theme.id)} count={theme.questions}>
              {theme.name}
            </Chip>
          ))}
        </div>
      </Field>
    </div>
  );
}

/** The players of a turn game on one phone. */
export function RosterField({ names, onChange, max, min }: { names: string[]; onChange: (names: string[]) => void; max: number; min: number }) {
  return (
    <Field label="Jugadores" hint="Cada uno responde las mismas preguntas en su turno.">
      <ol className="grid gap-2.5 sm:grid-cols-2">
        {names.map((name, position) => (
          <li key={position} className="flex items-center gap-3">
            <Avatar name={name.trim() || String(position + 1)} />
            <input
              value={name}
              maxLength={24}
              onChange={(event) => onChange(names.map((item, at) => (at === position ? event.target.value : item)))}
              placeholder={`Jugador ${position + 1}`}
              className={field}
            />
            {names.length > min ? (
              <button type="button" aria-label={`Quitar jugador ${position + 1}`} onClick={() => onChange(names.filter((_, at) => at !== position))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-sage hover:text-ink">
                ✕
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {names.length < max ? (
        <button type="button" onClick={() => onChange([...names, ""])} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-dashed border-line px-5 text-sm font-semibold text-ink transition hover:border-ink/30">
          + Agregar jugador
        </button>
      ) : null}
    </Field>
  );
}

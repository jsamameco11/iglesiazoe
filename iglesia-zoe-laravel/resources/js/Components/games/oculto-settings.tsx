import { Chip, Field } from "@/Components/games/ui";
import type { Theme } from "@/lib/games";

export type OcultoSettings = { categories: string[]; impostors: number; clue_rounds: number; rounds: number };

/** Settings of a live El Cristiano Oculto room; the room trims them to the players seated when it starts. */
export function OcultoSettingsForm({ themes, value, onChange }: { themes: Theme[]; value: OcultoSettings; onChange: (next: OcultoSettings) => void }) {
  const toggle = (id: string) => onChange({ ...value, categories: value.categories.includes(id) ? value.categories.filter((item) => item !== id) : [...value.categories, id] });

  return (
    <div className="grid gap-8">
      <Field label="Temas" hint="Sin elegir ninguno, la palabra sale de cualquier tema.">
        <div className="flex flex-wrap gap-2">
          <Chip active={!value.categories.length} onClick={() => onChange({ ...value, categories: [] })}>Todos</Chip>
          {themes.map((theme) => (
            <Chip key={theme.id} active={value.categories.includes(theme.id)} onClick={() => toggle(theme.id)}>{theme.name}</Chip>
          ))}
        </div>
      </Field>
      <div className="grid gap-8 md:grid-cols-3">
        <Field label="Cristianos ocultos" hint="Dos solo con 5 jugadores o más.">
          <div className="flex gap-2">
            {[1, 2].map((count) => (
              <Chip key={count} active={value.impostors === count} onClick={() => onChange({ ...value, impostors: count })}>{count}</Chip>
            ))}
          </div>
        </Field>
        <Field label="Vueltas de pistas" hint="Cuántas veces habla cada uno antes de votar.">
          <div className="flex gap-2">
            {[1, 2, 3].map((count) => (
              <Chip key={count} active={value.clue_rounds === count} onClick={() => onChange({ ...value, clue_rounds: count })}>{count}</Chip>
            ))}
          </div>
        </Field>
        <Field label="Rondas para escapar" hint="Con pocos jugadores se ajusta solo.">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((count) => (
              <Chip key={count} active={value.rounds === count} onClick={() => onChange({ ...value, rounds: count })}>{count}</Chip>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

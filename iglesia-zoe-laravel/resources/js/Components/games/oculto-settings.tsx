import { Chip, Choice, Field } from "@/Components/games/ui";
import { OCULTO_LEVELS, type OcultoLevel, type Theme } from "@/lib/games";

export type OcultoSettings = { categories: string[]; impostors: number; level: OcultoLevel };

export const OCULTO_DEFAULTS: OcultoSettings = { categories: [], impostors: 1, level: "intermedio" };

/** Themes that have words of a level. */
export const themesOf = (themes: Theme[], level: OcultoLevel) => themes.filter((theme) => (theme.levels?.[level] ?? theme.words ?? 0) > 0);

/** Level, hidden players and themes of El Cristiano Oculto; shared by one phone and live rooms. */
export function OcultoSettingsForm({ themes, value, onChange, players }: { themes: Theme[]; value: OcultoSettings; onChange: (next: OcultoSettings) => void; players?: number }) {
  const shown = themesOf(themes, value.level);
  const toggle = (id: string) => onChange({ ...value, categories: value.categories.includes(id) ? value.categories.filter((item) => item !== id) : [...value.categories, id] });
  const words = (level: OcultoLevel) => themes.reduce((sum, theme) => sum + (theme.levels?.[level] ?? 0), 0);
  const fewForTwo = players !== undefined && players < 5;

  function pickLevel(level: OcultoLevel) {
    const open = new Set(themesOf(themes, level).map((theme) => theme.id));
    onChange({ ...value, level, categories: value.categories.filter((id) => open.has(id)) });
  }

  return (
    <div className="grid gap-8">
      <Field label="Nivel">
        <div className="grid gap-3 sm:grid-cols-2">
          {OCULTO_LEVELS.map((level) => (
            <Choice key={level.key} active={value.level === level.key} onClick={() => pickLevel(level.key)} title={level.title} text={level.text} meta={words(level.key) ? `${words(level.key)} palabras` : undefined} />
          ))}
        </div>
      </Field>
      <Field label="Cristianos ocultos" hint={fewForTwo ? "Con menos de 5 jugadores se juega con uno." : "Dos ocultos solo con 5 jugadores o más."}>
        <div className="flex gap-2">
          {[1, 2].map((count) => (
            <Chip key={count} active={(fewForTwo ? 1 : value.impostors) === count} disabled={count === 2 && fewForTwo} onClick={() => onChange({ ...value, impostors: count })}>
              {count === 1 ? "Uno" : "Dos"}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Temas" hint="Sin elegir ninguno, la palabra sale de cualquier tema de este nivel.">
        <div className="flex flex-wrap gap-2">
          <Chip active={!value.categories.length} onClick={() => onChange({ ...value, categories: [] })}>
            Todos
          </Chip>
          {shown.map((theme) => (
            <Chip key={theme.id} active={value.categories.includes(theme.id)} onClick={() => toggle(theme.id)} count={theme.levels?.[value.level]}>
              {theme.name}
            </Chip>
          ))}
        </div>
      </Field>
    </div>
  );
}

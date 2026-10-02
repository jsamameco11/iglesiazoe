import type { FontKind, FontOption, FontRole } from "./types";

export const fontRoles: { key: FontRole; label: string; text: string }[] = [
  { key: "heading", label: "Títulos", text: "Encabezados, frases destacadas y nombres grandes." },
  { key: "text", label: "Textos", text: "Párrafos, menús, botones y formularios." },
  { key: "accent", label: "Acentos", text: "Etiquetas en mayúsculas, insignias y cifras cortas." },
];

/** Families bundled with the site; the rest come from fonts.bunny.net. */
const bundled: Record<string, string> = {
  Fraunces: '"Fraunces Soft"',
  Inter: '"Inter Variable", "Inter"',
  Fredoka: '"Fredoka Variable", "Fredoka"',
};

const fallback: Record<FontKind, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: "ui-sans-serif, system-ui, sans-serif",
  round: "ui-rounded, ui-sans-serif, sans-serif",
};

export function fontStack(font: FontOption) {
  return `${bundled[font.name] ?? `"${font.name}"`}, ${fallback[font.kind] ?? fallback.sans}`;
}

export function fontHref(fonts: FontOption[]) {
  const slugs = [...new Set(fonts.filter((font) => !font.local).map((font) => `${font.slug}:400,400i,500,600,700`))];
  return slugs.length ? `https://fonts.bunny.net/css?family=${slugs.join("|")}&display=swap` : "";
}

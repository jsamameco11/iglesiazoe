/** Lowercase text without accents, so a search for «oracion» finds «Oración». */
export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Keeps only the digits a person typed, up to `max` of them. */
export function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

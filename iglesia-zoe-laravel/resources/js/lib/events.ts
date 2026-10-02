function day(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function eventBadge(startsOn: string) {
  const date = day(startsOn);
  return {
    day: date.toLocaleDateString("es-PE", { day: "numeric" }),
    month: date.toLocaleDateString("es-PE", { month: "short" }).replace(".", ""),
    weekday: date.toLocaleDateString("es-PE", { weekday: "long" }),
  };
}

/** "sábado 12 de octubre" or "12 al 14 de octubre" / "30 de octubre al 2 de noviembre". */
export function eventDateLabel(startsOn: string, endsOn?: string | null) {
  const start = day(startsOn);
  if (!endsOn || endsOn.slice(0, 10) === startsOn.slice(0, 10)) {
    return start.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  }
  const end = day(endsOn);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const from = sameMonth ? start.toLocaleDateString("es-PE", { day: "numeric" }) : start.toLocaleDateString("es-PE", { day: "numeric", month: "long" });
  return `${from} al ${end.toLocaleDateString("es-PE", { day: "numeric", month: "long" })}`;
}

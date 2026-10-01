function splitLead(text: string) {
  const comma = text.indexOf(",");
  if (comma !== -1) {
    return { lead: text.slice(0, comma + 1), accent: text.slice(comma + 1).trim() };
  }
  const lastSpace = text.lastIndexOf(" ");
  if (lastSpace > 0) {
    return { lead: text.slice(0, lastSpace), accent: text.slice(lastSpace + 1) };
  }
  return { lead: text, accent: "" };
}

export function LeadTitle({
  as: Tag = "h1",
  text,
  lead,
  accent,
  className = "",
}: {
  as?: "h1" | "h2" | "h3";
  text?: string;
  lead?: string;
  accent?: string;
  className?: string;
}) {
  const parts = text ? splitLead(text) : { lead: lead || "", accent: accent || "" };
  return (
    <Tag className={`editorial lead ${className}`}>
      {parts.lead}
      {parts.accent ? (
        <>
          {parts.lead ? " " : null}
          <span className="ital ink">{parts.accent}</span>
        </>
      ) : null}
    </Tag>
  );
}

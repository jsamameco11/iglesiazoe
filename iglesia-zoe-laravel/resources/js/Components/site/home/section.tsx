import { LeadTitle } from "@/Components/site/lead-title";

export function SectionHead({ kicker, title, tone = "ink", className = "" }: { kicker: string; title: string; tone?: "ink" | "light"; className?: string }) {
  return (
    <div className={className}>
      <p className="kicker">{kicker}</p>
      {tone === "light" ? (
        <h2 className="editorial mt-5 text-4xl leading-[1.05] text-white md:text-6xl">{title}</h2>
      ) : (
        <LeadTitle as="h2" text={title} className="mt-5 text-4xl leading-[1.05] md:text-6xl" />
      )}
    </div>
  );
}

export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return (
    <div className={`home-prose ${className}`.trim()}>
      {parts.map((part, index) => (
        <p key={index}>{part}</p>
      ))}
    </div>
  );
}

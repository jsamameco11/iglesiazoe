import type { CSSProperties, ReactNode } from "react";

export function Marquee({
  items,
  className = "",
  reverse = false,
  duration = 34,
  gap = "2.5rem",
  separator,
}: {
  items: ReactNode[];
  className?: string;
  reverse?: boolean;
  duration?: number;
  gap?: string;
  separator?: ReactNode;
}) {
  const style = { "--duration": `${duration}s`, "--gap": gap } as CSSProperties;
  const row = (
    <div className="marquee__track" aria-hidden>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-[var(--gap)]">
          {item}
          {separator ?? <span className="opacity-40">/</span>}
        </span>
      ))}
    </div>
  );
  return (
    <div className={`marquee ${reverse ? "marquee--reverse" : ""} ${className}`} style={style}>
      {row}
      {row}
    </div>
  );
}

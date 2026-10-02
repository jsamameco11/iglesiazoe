type Reveal = "up" | "left" | "right" | "scale";

/** A block that enters as one piece; the motion itself runs in useAutoReveal. */
export function Rise({
  children,
  className = "",
  delay = 0,
  from = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: Reveal;
}) {
  return (
    <div data-reveal={from} data-reveal-delay={delay || undefined} className={`rise ${className}`.trim()}>
      {children}
    </div>
  );
}

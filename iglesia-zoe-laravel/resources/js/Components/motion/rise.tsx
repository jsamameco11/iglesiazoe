type Reveal = "up" | "left" | "right" | "scale";

/** A block that enters as one piece; the motion itself runs in useAutoReveal. */
export function Rise({
  children,
  className = "",
  delay = 0,
  from = "up",
  ...attrs
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: Reveal;
  [data: `data-${string}`]: string | undefined;
}) {
  return (
    <div {...attrs} data-reveal={from} data-reveal-delay={delay || undefined} className={`rise ${className}`.trim()}>
      {children}
    </div>
  );
}

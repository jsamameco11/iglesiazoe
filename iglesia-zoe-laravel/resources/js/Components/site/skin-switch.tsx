import { Link } from "@inertiajs/react";
import { useId } from "react";

function Sunburst({ className = "" }: { className?: string }) {
  const mask = `sun-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <mask id={mask}>
          <rect width="32" height="32" fill="#fff" />
          <circle cx="16" cy="16" r="3.15" fill="#000" />
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${mask})`}>
        <circle cx="16" cy="16" r="4.7" />
        {Array.from({ length: 8 }, (_, index) => (
          <ellipse
            key={index}
            cx="16"
            cy="7.05"
            rx="2.2"
            ry="4.55"
            transform={`rotate(${index * 45} 16 16)`}
          />
        ))}
      </g>
    </svg>
  );
}

export function AccessButton({
  ghost = false,
  invert = false,
}: {
  ghost?: boolean;
  invert?: boolean;
}) {
  if (ghost) {
    return <span className="inline-block h-10 w-10 shrink-0" aria-hidden />;
  }

  return (
    <Link
      href="/acceso"
      aria-label="Acceso al sistema"
      title="Acceso al sistema"
      className={`skin-switch ${invert ? "skin-switch-invert" : ""}`}
    >
      <Sunburst className="h-[18px] w-[18px]" />
    </Link>
  );
}

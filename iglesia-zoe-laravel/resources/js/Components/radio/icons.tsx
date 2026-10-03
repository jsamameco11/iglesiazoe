type Props = { className?: string };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function PlayIcon({ className = "h-7 w-7" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" />
    </svg>
  );
}

export function SpotifyIcon({ className = "h-5 w-5" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M6.6 9.3c3.6-1.1 7.9-.8 11 1M7.3 12.6c3-.8 6.3-.5 8.9.9M8 15.7c2.3-.6 4.7-.3 6.7.8" fill="none" stroke="#0b0b0c" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Jump back or forward a few seconds; the number is drawn inside the arrow. */
export function SkipIcon({ seconds, forward = false, className = "h-8 w-8" }: Props & { seconds: number; forward?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.5}>
      <path d={forward ? "M20 12a8 8 0 1 1-2.34-5.66M20 3.8v3.6h-3.6" : "M4 12a8 8 0 1 0 2.34-5.66M4 3.8v3.6h3.6"} />
      <text x="12" y="15.4" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" stroke="none">{seconds}</text>
    </svg>
  );
}

export function StopIcon({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function MicIcon({ className = "h-5 w-5" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

export function VolumeIcon({ className = "h-5 w-5" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

export function HeadphonesIcon({ className = "h-5 w-5" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3.5" y="13.5" width="4.5" height="7" rx="2" />
      <rect x="16" y="13.5" width="4.5" height="7" rx="2" />
    </svg>
  );
}

/** Music lowered under a voice or an announcement. */
export function DuckIcon({ className = "h-4 w-4" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 9.5h3L10 6v12l-4-3.5H3z" />
      <path d="M14 10l3.5 3.5L21 10M17.5 13.5V5" />
    </svg>
  );
}

export function UsersIcon({ className = "h-4 w-4" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.5a6.5 6.5 0 0 1 3 5.5" />
    </svg>
  );
}

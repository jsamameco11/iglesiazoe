import { flagUrl } from "@/lib/geo";

type IconProps = { className?: string };

function Icon({ className = "h-5 w-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <Icon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.6 4.8h2.2l1.1 2.7-1.4 1.4a12.6 12.6 0 0 0 6 6l1.4-1.4 2.7 1.1v2.2c0 .7-.5 1.4-1.2 1.5A15.4 15.4 0 0 1 5.1 6c.1-.7.8-1.2 1.5-1.2Z" />
    </Icon>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Icon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </Icon>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path strokeLinecap="round" d="m4.2 7.4 7.8 6.2 7.8-6.2" />
    </Icon>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function IconBank(props: IconProps) {
  return (
    <Icon {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5 12 4.5l8.5 5M5 19.5h14M6 10v7M10 10v7M14 10v7M18 10v7" />
    </Icon>
  );
}

export function IconPhoneQr(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="3" width="11" height="18" rx="2.4" />
      <path strokeLinecap="round" d="M9.5 7.5h2v2h-2zM12.5 11.5h2v2h-2zM9.5 12.5v1M14.5 8.5v1M11 18h2" />
    </Icon>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5Z" />
    </Icon>
  );
}

export function IconCard(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="12.5" rx="2.2" />
      <path strokeLinecap="round" d="M3 10h18M7 15h3" />
    </Icon>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <Icon {...props}>
      <path strokeLinejoin="round" fill="currentColor" d="M9 7.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L9.9 6.7a.6.6 0 0 0-.9.5Z" />
    </Icon>
  );
}

/** Country flag shown next to each option of the country and phone-code pickers. */
export function Flag({ code }: { code: string }) {
  return <img src={flagUrl(code)} alt="" width={20} height={14} loading="lazy" className="visit-flag" />;
}

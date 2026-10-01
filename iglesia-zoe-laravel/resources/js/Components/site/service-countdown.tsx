import { useEffect, useState } from "react";
import { SocialIcon } from "@/Components/site/social-icons";
import { formatCountdown, nextService } from "@/lib/next-service";
import { liveUrl, socialLinks } from "@/lib/social";

export function ServiceCountdown({
  sunday,
  wednesday,
}: {
  sunday: string;
  wednesday: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const next = nextService(sunday, wednesday, new Date(now));
  const href = next.live ? liveUrl : "/visita";

  return (
    <div className="service-chip">
      <a
        href={href}
        target={next.live ? "_blank" : undefined}
        rel={next.live ? "noreferrer" : undefined}
        className="service-chip-link"
        aria-label={next.live ? "Estamos en vivo" : "Siguiente culto: planifica tu visita"}
      />
      <div className="service-chip-body">
        <p className="service-chip-time">{next.live ? "En vivo" : formatCountdown(next.at - now)}</p>
        <p className="service-chip-label">{next.live ? "Estamos reunidos" : "Siguiente culto"}</p>
        <div className="service-chip-social">
          {socialLinks.map((item) => (
            <a key={item.id} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
              <SocialIcon id={item.id} />
            </a>
          ))}
        </div>
      </div>
      <svg className="service-chip-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 17.5 17.5 6.5M8.5 6.5h9v9" />
      </svg>
    </div>
  );
}

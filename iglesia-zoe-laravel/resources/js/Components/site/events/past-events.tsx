import { SocialIcon } from "@/Components/site/social-icons";
import { monthYearLabel } from "@/lib/events";
import type { PastEvent } from "@/lib/types";

const NETWORK: Record<NonNullable<PastEvent["platform"]>, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/** «Conoce más de nuestros eventos anteriores»: each card opens its post on the church's network. */
export function PastEvents({ events, more }: { events: PastEvent[]; more: string }) {
  return (
    <ul className="past-events">
      {events.map((event) => {
        const network = event.platform ? NETWORK[event.platform] : null;
        return (
          <li key={event.id}>
            <a href={event.url} target="_blank" rel="noopener noreferrer" className="past-event" aria-label={`${event.title}${network ? ` · ver en ${network}` : ""}`}>
              <span className="past-event-art">
                {event.image ? <img src={event.image} alt="" loading="lazy" /> : null}
              </span>
              {event.platform ? (
                <span className="past-event-network" aria-hidden>
                  <SocialIcon id={event.platform} />
                </span>
              ) : null}
              <span className="past-event-body">
                <span className="past-event-date">{monthYearLabel(event.held_on)}</span>
                <span className="past-event-title">{event.title}</span>
                <span className="past-event-more">
                  {more}
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

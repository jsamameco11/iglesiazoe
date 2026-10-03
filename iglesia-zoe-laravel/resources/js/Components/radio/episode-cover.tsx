/** Square cover of an episode; without an image it shows the initials of the title on the accent color. */
export function EpisodeCover({ src, title, className = "" }: { src: string | null; title: string; className?: string }) {
  if (src) return <img src={src} alt="" loading="lazy" className={`shrink-0 object-cover ${className}`} />;
  const initials = title
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return (
    <span aria-hidden className={`episode-cover-blank grid shrink-0 place-items-center ${className}`}>
      <span>{initials || "Z"}</span>
    </span>
  );
}

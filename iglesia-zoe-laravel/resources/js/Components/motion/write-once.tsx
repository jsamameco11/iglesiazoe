import { useEffect, useState } from "react";
import { useArt } from "@/lib/design";

export function WriteOnce({
  text,
  className = "",
  delay = 420,
  step = 26,
}: {
  text: string;
  className?: string;
  delay?: number;
  step?: number;
}) {
  const full = `“${text}”`;
  const art = useArt("write");
  const speed = art.speed ?? 1;
  const still = Boolean(art.still);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCount(0);
    setDone(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || still || !full) {
      setCount(full.length);
      setDone(true);
      return;
    }

    let i = 0;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= full.length) {
          window.clearInterval(interval);
          setDone(true);
        }
      }, step / speed);
    }, delay / speed);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [full, delay, step, speed, still]);

  return (
    <span className={`write-once ${className}`.trim()} data-art="write">
      <span className="write-once-ghost" aria-hidden="true">{full}</span>
      <span className="write-once-live">
        {full.slice(0, count)}
        {!done ? <span className="write-caret" aria-hidden="true" /> : null}
      </span>
    </span>
  );
}

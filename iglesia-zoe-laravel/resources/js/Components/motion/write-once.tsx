import { useEffect, useState } from "react";

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
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCount(0);
    setDone(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !full) {
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
      }, step);
    }, delay);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [full, delay, step]);

  return (
    <span className={`write-once ${className}`.trim()}>
      <span className="write-once-ghost" aria-hidden="true">{full}</span>
      <span className="write-once-live">
        {full.slice(0, count)}
        {!done ? <span className="write-caret" aria-hidden="true" /> : null}
      </span>
    </span>
  );
}

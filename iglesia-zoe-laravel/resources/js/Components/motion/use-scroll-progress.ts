
import { useEffect, useState, type RefObject } from "react";

export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      const total = Math.max(node.offsetHeight - window.innerHeight, 1);
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(scrolled / total);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return progress;
}

import { useCallback, useEffect, useState } from "react";

export function useStored(key: string): [string[], (next: string[]) => void] {
  const [value, setValue] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });
  const save = useCallback(
    (next: string[]) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next.slice(-200)));
      } catch {
        // Private mode: the list only lives for this visit.
      }
    },
    [key],
  );
  return [value, save];
}

export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

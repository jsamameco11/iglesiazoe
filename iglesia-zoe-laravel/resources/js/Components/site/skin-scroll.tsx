
import { useEffect } from "react";

export function SkinScroll({ skin }: { skin: "aire" | "marea" }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.skin;
    root.dataset.skin = skin;
    return () => {
      root.dataset.skin = previous || "aire";
    };
  }, [skin]);

  return null;
}

import { usePage } from "@inertiajs/react";
import { useEffect } from "react";
import { designAttributes, pageOfComponent, type Design } from "@/lib/design";
import type { SiteSettings } from "@/lib/types";

export function useSitePalette() {
  const page = usePage();
  const { settings, design } = page.props as unknown as { settings?: SiteSettings; design?: Design };
  const { style, attrs } = designAttributes(design, pageOfComponent[page.component], settings || {});
  const styleKey = JSON.stringify(style);

  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(JSON.parse(styleKey) as Record<string, string>);
    entries.forEach(([name, value]) => root.style.setProperty(name, value));
    return () => entries.forEach(([name]) => root.style.removeProperty(name));
  }, [styleKey]);

  return { style, attrs };
}

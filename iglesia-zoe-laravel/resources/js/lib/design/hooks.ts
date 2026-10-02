import { usePage } from "@inertiajs/react";
import { useEffect, useSyncExternalStore } from "react";
import { fontHref } from "./fonts";
import { collectSections, getDraft, isPreview, postToEditor, PREVIEW_CSS, subscribeDraft } from "./preview";
import { designAttributes, designCss } from "./styles";
import type { ArtRule, Design } from "./types";

/** The design in force: the published one, or the editor's draft inside the live preview. */
export function useDesign(): Design | undefined {
  const stored = (usePage().props as { design?: Design }).design;
  const draft = useSyncExternalStore(subscribeDraft, getDraft, () => null);
  return draft ?? stored;
}

export function useArt(key: string): ArtRule {
  return useDesign()?.art?.[key] ?? {};
}

function useRootVars(style: Record<string, string>) {
  const styleKey = JSON.stringify(style);
  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(JSON.parse(styleKey) as Record<string, string>);
    entries.forEach(([name, value]) => root.style.setProperty(name, value));
    return () => entries.forEach(([name]) => root.style.removeProperty(name));
  }, [styleKey]);
}

function useHeadNode(id: string, tag: "link" | "style", value: string) {
  useEffect(() => {
    let node = document.getElementById(id) as HTMLLinkElement | HTMLStyleElement | null;
    if (!value) {
      node?.remove();
      return;
    }
    if (!node) {
      node = document.createElement(tag);
      node.id = id;
      if (node instanceof HTMLLinkElement) node.rel = "stylesheet";
      document.head.appendChild(node);
    }
    if (node instanceof HTMLLinkElement) node.href = value;
    else node.textContent = value;
  }, [id, tag, value]);
}

/** Applies each illustration's animation speed, including animations that start later. */
function useArtSpeed(art: Design["art"] | undefined) {
  const speeds = JSON.stringify(Object.entries(art ?? {}).map(([key, rule]) => [key, rule.speed ?? 1]));
  useEffect(() => {
    const rates = new Map(JSON.parse(speeds) as [string, number][]);
    const rateOf = (el: Element) => rates.get(el.closest("[data-art]")?.getAttribute("data-art") || "") ?? 1;
    document.querySelectorAll("[data-art]").forEach((el) => el.getAnimations({ subtree: true }).forEach((animation) => (animation.playbackRate = rateOf(el))));
    const onStart = (event: AnimationEvent) => {
      const target = event.target as Element;
      if (target.closest("[data-art]")) target.getAnimations().forEach((animation) => (animation.playbackRate = rateOf(target)));
    };
    document.addEventListener("animationstart", onStart, true);
    return () => document.removeEventListener("animationstart", onStart, true);
  }, [speeds]);
}

function usePreviewBridge(page: string, preview: boolean) {
  useEffect(() => {
    if (!preview) return;
    const report = () => postToEditor({ type: "zoe:ready", page, sections: collectSections() });
    const timer = window.setTimeout(report, 350);
    window.addEventListener("load", report);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", report);
    };
  }, [page, preview]);
}

/** Paints the public site with the design: palette, fonts, sizes, sections and illustrations. */
export function useSiteDesign() {
  const page = usePage();
  const design = useDesign();
  const preview = isPreview();
  const { style, attrs } = designAttributes(design, page.component);

  useRootVars(style);
  useHeadNode("zoe-design-rules", "style", designCss(design, page.component, preview) + (preview ? PREVIEW_CSS : ""));
  useHeadNode("zoe-site-fonts", "link", preview && design ? fontHref(Object.values(design.fonts)) : design?.fontHref || "");
  useArtSpeed(design?.art);
  usePreviewBridge(page.component, preview);

  return { style, attrs };
}

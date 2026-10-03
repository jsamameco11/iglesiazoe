import { usePage } from "@inertiajs/react";
import { useEffect, useSyncExternalStore } from "react";
import { fontHref } from "./fonts";
import { collectSections, getDraft, isPreview, postToEditor, PREVIEW_CSS, subscribeDraft } from "./preview";
import { backdropVideos, designAttributes, designCss } from "./styles";
import type { ArtRule, Design } from "./types";

/** The design in force: the published one, or the editor's draft inside the live preview. */
function useDesign(): Design | undefined {
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

/** Plays the video backgrounds behind the page or its bands, muted and looping, under a tint layer. */
function useBackdropVideos(design: Design | undefined, page: string, url: string) {
  const videos = JSON.stringify(backdropVideos(design, page));
  useEffect(() => {
    const list = JSON.parse(videos) as ReturnType<typeof backdropVideos>;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];
    list.forEach((item) => {
      const host = document.querySelector<HTMLElement>(item.section ? `[data-design-page] [data-section="${CSS.escape(item.section)}"]` : "[data-design-page]");
      if (!host) return;
      const layer = document.createElement("div");
      layer.setAttribute("data-design-video", "");
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText = `position:${item.fixed ? "fixed" : "absolute"};inset:0;z-index:-1;overflow:hidden;pointer-events:none`;
      const video = document.createElement("video");
      Object.assign(video, { src: item.src, muted: true, loop: true, playsInline: true, autoplay: !still, preload: still ? "metadata" : "auto" });
      video.style.cssText = "width:100%;height:100%;object-fit:cover";
      layer.appendChild(video);
      if (item.tint) {
        const shade = document.createElement("span");
        shade.style.cssText = `position:absolute;inset:0;background:${item.tint}`;
        layer.appendChild(shade);
      }
      const staticHost = getComputedStyle(host).position === "static";
      if (staticHost) host.style.position = "relative";
      host.prepend(layer);
      cleanups.push(() => {
        layer.remove();
        if (staticHost) host.style.position = "";
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [videos, url]);
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
  useBackdropVideos(design, page.component, page.url);
  usePreviewBridge(page.component, preview);

  return { style, attrs };
}

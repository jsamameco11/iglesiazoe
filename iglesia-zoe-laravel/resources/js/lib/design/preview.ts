import { textSelector } from "./styles";
import type { Design, SectionInfo, TextPick } from "./types";

/**
 * Live preview channel between the Diseño editor (parent window) and the public
 * page it shows in an iframe. The page renders the editor's unpublished draft,
 * reports its sections and lets the editor pick a section, or a single text, by clicking it.
 */
export const PREVIEW_PARAM = "vista-diseno";

export type PickMode = "section" | "text";

export type EditorMessage =
  | { type: "zoe:design"; design: Design }
  | { type: "zoe:focus"; section: string | null }
  | { type: "zoe:mode"; mode: PickMode }
  | { type: "zoe:text"; path: string | null };
export type PageMessage = { type: "zoe:ready"; page: string; sections: SectionInfo[] } | { type: "zoe:pick"; section: string } | { type: "zoe:pickText"; text: TextPick };

const BLUE = "#2563eb";

export const PREVIEW_CSS = `
html:not([data-design-mode="text"]) [data-section] { cursor: pointer; transition: outline-color 0.15s ease; outline: 2px dashed transparent; outline-offset: -3px; }
html:not([data-design-mode="text"]) [data-section]:hover { outline-color: color-mix(in srgb, ${BLUE} 55%, transparent); }
html:not([data-design-mode="text"]) [data-section][data-design-picked] { outline: 3px solid ${BLUE}; }
html[data-design-mode="text"] [data-design-hover] { cursor: pointer; outline: 2px dashed color-mix(in srgb, ${BLUE} 70%, transparent) !important; outline-offset: 3px !important; }
html[data-design-mode="text"] [data-design-text-picked] { outline: 3px solid ${BLUE} !important; outline-offset: 3px !important; }
`;

/** Elements that read as one text: clicking a word inside picks the whole heading, paragraph, link or button. */
const TEXT_BLOCKS = "h1, h2, h3, h4, h5, h6, p, blockquote, figcaption, dt, dd, label, a, button, li";
const CONTAINERS = "a, button, li, label";
const RICH = "h1, h2, h3, h4, h5, h6, p, img, picture, video";
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DEPTH = 16;

let draft: Design | null = null;
let listening = false;
let mode: PickMode = "section";
let hovered: Element | null = null;
let pickedText: string | null = null;
const listeners = new Set<() => void>();

export function isPreview() {
  return typeof window !== "undefined" && window.parent !== window && new URLSearchParams(window.location.search).has(PREVIEW_PARAM);
}

function editorOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

export function postToEditor(message: PageMessage) {
  window.parent.postMessage(message, editorOrigin() || "*");
}

export function getDraft() {
  return draft;
}

export function subscribeDraft(listener: () => void) {
  listeners.add(listener);
  listen();
  return () => listeners.delete(listener);
}

function listen() {
  if (listening || !isPreview()) return;
  listening = true;
  const origin = editorOrigin();
  window.addEventListener("message", (event: MessageEvent<EditorMessage>) => {
    if (event.source !== window.parent || (origin && event.origin !== origin)) return;
    const data = event.data;
    if (data?.type === "zoe:design" && data.design) {
      draft = data.design;
      listeners.forEach((listener) => listener());
    }
    if (data?.type === "zoe:focus") focusSection(data.section, true);
    if (data?.type === "zoe:mode") setMode(data.mode);
    if (data?.type === "zoe:text" && data.path !== pickedText) {
      pickedText = data.path;
      const text = focusText(data.path, true);
      if (text && data.path) postToEditor({ type: "zoe:pickText", text: describe(text, data.path) });
    }
  });
  document.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (mode === "text") return pickText(event.target as Element | null);
      const zone = (event.target as Element | null)?.closest?.("[data-section]");
      const key = zone?.getAttribute("data-section");
      if (!key) return;
      focusSection(key, false);
      postToEditor({ type: "zoe:pick", section: key });
    },
    true,
  );
  document.addEventListener("mouseover", (event) => {
    if (mode !== "text") return;
    const text = textAt(event.target as Element | null);
    if (text === hovered) return;
    hovered?.removeAttribute("data-design-hover");
    hovered = text;
    text?.setAttribute("data-design-hover", "");
  });
  document.addEventListener("submit", (event) => event.preventDefault(), true);
}

function setMode(next: PickMode) {
  mode = next === "text" ? "text" : "section";
  document.documentElement.setAttribute("data-design-mode", mode);
  hovered?.removeAttribute("data-design-hover");
  hovered = null;
}

function focusSection(key: string | null, scroll: boolean) {
  document.querySelectorAll("[data-design-picked]").forEach((el) => el.removeAttribute("data-design-picked"));
  if (!key) return;
  const zone = document.querySelector(`[data-section="${CSS.escape(key)}"]`);
  if (!zone) return;
  zone.setAttribute("data-design-picked", "");
  if (scroll) zone.scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusText(path: string | null, scroll: boolean) {
  document.querySelectorAll("[data-design-text-picked]").forEach((el) => el.removeAttribute("data-design-text-picked"));
  const selector = path ? textSelector(path) : "";
  const text = selector ? document.querySelector(selector) : null;
  if (!text) return null;
  text.setAttribute("data-design-text-picked", "");
  if (scroll) text.scrollIntoView({ behavior: "smooth", block: "center" });
  return text;
}

function describe(text: Element, path: string): TextPick {
  const label = (text.textContent || text.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return { path, label, tag: text.tagName.toLowerCase(), display: getComputedStyle(text).display };
}

function ownText(el: Element) {
  return Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
}

/** The text a click or hover lands on, or null when it lands on a photo, an icon or an empty box. */
function textAt(target: Element | null): HTMLElement | null {
  const root = document.querySelector("[data-design-page]");
  if (!target || !root?.contains(target) || target === root) return null;
  const block = target.closest<HTMLElement>(TEXT_BLOCKS);
  if (block && root.contains(block) && block !== root) {
    if (block.matches(CONTAINERS) && block.querySelector(RICH)) return null;
    return block.textContent?.trim() ? block : null;
  }
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el instanceof HTMLElement && ownText(el)) return el;
  }
  return null;
}

/** Address of a text that survives reloads: its band, then its place among the children at each level. */
function pathOf(el: Element): string | null {
  const root = document.querySelector("[data-design-page]");
  const steps: number[] = [];
  for (let node: Element = el; node !== root; ) {
    const key = node.getAttribute("data-section");
    if (node !== el && key && KEY.test(key)) return steps.length <= DEPTH ? `${key}:${steps.reverse().join(".")}` : null;
    const parent = node.parentElement;
    if (!parent) return null;
    const place = Array.from(parent.children).filter((child) => !child.hasAttribute("data-design-video")).indexOf(node) + 1;
    if (place < 1 || place > 999) return null;
    steps.push(place);
    node = parent;
  }
  return steps.length && steps.length <= DEPTH ? `~:${steps.reverse().join(".")}` : null;
}

function pickText(target: Element | null) {
  const text = textAt(target);
  const path = text ? pathOf(text) : null;
  if (!text || !path) return;
  pickedText = path;
  focusText(path, false);
  postToEditor({ type: "zoe:pickText", text: describe(text, path) });
}

export function collectSections(): SectionInfo[] {
  const seen = new Set<string>();
  return Array.from(document.querySelectorAll<HTMLElement>("[data-section]"))
    .map((el) => ({ key: el.dataset.section || "", label: el.dataset.sectionLabel || el.querySelector("h1, h2, h3")?.textContent?.trim() || el.dataset.section || "" }))
    .filter((info) => info.key && !seen.has(info.key) && seen.add(info.key));
}

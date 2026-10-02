import type { Design, SectionInfo } from "./types";

/**
 * Live preview channel between the Diseño editor (parent window) and the public
 * page it shows in an iframe. The page renders the editor's unpublished draft,
 * reports its sections and lets the editor pick one by clicking it.
 */
export const PREVIEW_PARAM = "vista-diseno";

export type EditorMessage = { type: "zoe:design"; design: Design } | { type: "zoe:focus"; section: string | null };
export type PageMessage = { type: "zoe:ready"; page: string; sections: SectionInfo[] } | { type: "zoe:pick"; section: string };

export const PREVIEW_CSS = `
[data-section] { cursor: pointer; transition: outline-color 0.15s ease; outline: 2px dashed transparent; outline-offset: -3px; }
[data-section]:hover { outline-color: color-mix(in srgb, #2563eb 55%, transparent); }
[data-section][data-design-picked] { outline: 3px solid #2563eb; }
`;

let draft: Design | null = null;
let listening = false;
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
    if (event.data?.type === "zoe:design" && event.data.design) {
      draft = event.data.design;
      listeners.forEach((listener) => listener());
    }
    if (event.data?.type === "zoe:focus") focusSection(event.data.section, true);
  });
  document.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const zone = (event.target as Element | null)?.closest?.("[data-section]");
      const key = zone?.getAttribute("data-section");
      if (!key) return;
      focusSection(key, false);
      postToEditor({ type: "zoe:pick", section: key });
    },
    true,
  );
  document.addEventListener("submit", (event) => event.preventDefault(), true);
}

function focusSection(key: string | null, scroll: boolean) {
  document.querySelectorAll("[data-design-picked]").forEach((el) => el.removeAttribute("data-design-picked"));
  if (!key) return;
  const zone = document.querySelector(`[data-section="${CSS.escape(key)}"]`);
  if (!zone) return;
  zone.setAttribute("data-design-picked", "");
  if (scroll) zone.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function collectSections(): SectionInfo[] {
  const seen = new Set<string>();
  return Array.from(document.querySelectorAll<HTMLElement>("[data-section]"))
    .map((el) => ({ key: el.dataset.section || "", label: el.dataset.sectionLabel || el.querySelector("h1, h2, h3")?.textContent?.trim() || el.dataset.section || "" }))
    .filter((info) => info.key && !seen.has(info.key) && seen.add(info.key));
}

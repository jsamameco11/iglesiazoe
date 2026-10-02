import { useLayoutEffect, type RefObject } from "react";

const SELECTOR = [
  ".rise",
  "[data-reveal-item]",
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "blockquote",
  "li",
  "dt",
  "dd",
  "img",
  "video",
  "iframe",
  "form",
  ".panel",
  ".kicker",
  ".home-link",
  "a.rounded-full",
  "button.rounded-full",
  "[class*='rounded-[']",
  "[class*='rounded-2xl']",
  "[class*='rounded-3xl']",
].join(",");

const MAX_ITEMS = 420;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const WAIT = "data-reveal-wait";

type Kind = "block" | "heading" | "text" | "media";

function kindOf(el: Element): Kind {
  const tag = el.tagName;
  if (tag === "IMG" || tag === "VIDEO" || tag === "IFRAME") return "media";
  if (/^H[1-4]$/.test(tag)) return "heading";
  if (tag === "P" || tag === "LI" || tag === "DT" || tag === "DD" || tag === "BLOCKQUOTE" || el.classList.contains("kicker")) return "text";
  return "block";
}

function frames(el: Element, kind: Kind, nested: boolean, canMove: boolean): Keyframe[] {
  const from: Keyframe = { offset: 0, opacity: 0 };
  if (kind === "heading") from.filter = "blur(6px)";
  if (!canMove) return [from];

  if (kind === "media") {
    from.transform = "scale(1.06)";
  } else if (el.classList.contains("rise")) {
    const dir = el.getAttribute("data-reveal");
    from.transform =
      dir === "left" ? "translate3d(-28px, 0, 0)" : dir === "right" ? "translate3d(28px, 0, 0)" : dir === "scale" ? "scale(0.96)" : "translate3d(0, 34px, 0)";
  } else if (kind === "heading") {
    from.transform = `translate3d(0, ${nested ? 14 : 24}px, 0)`;
  } else if (kind === "text") {
    from.transform = `translate3d(0, ${nested ? 10 : 16}px, 0)`;
  } else {
    from.transform = nested ? "translate3d(0, 16px, 0)" : "translate3d(0, 30px, 0) scale(0.985)";
  }
  return [from];
}

/**
 * Brings the page in piece by piece: every heading, text, card and photo of `root`
 * fades and rises into place the first time it scrolls into view, including the
 * ones already on screen when the page opens.
 */
export function useAutoReveal(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const host = root.current;
    if (!host || typeof IntersectionObserver === "undefined" || typeof Element.prototype.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scrollers = new WeakMap<Element, boolean>();
    const scrollsSideways = (el: Element) => {
      let known = scrollers.get(el);
      if (known === undefined) {
        const style = getComputedStyle(el);
        known = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 4;
        scrollers.set(el, known);
      }
      return known;
    };

    const chosen = new Set<Element>();
    const items: { el: HTMLElement; nested: boolean }[] = [];

    for (const node of Array.from(host.querySelectorAll<HTMLElement>(SELECTOR))) {
      if (items.length >= MAX_ITEMS) break;
      if (node.closest("[data-reveal='off']")) continue;
      const form = node.closest("form");
      if (form && form !== node) continue;
      if (node.getClientRects().length === 0) continue;

      const style = getComputedStyle(node);
      if (style.position === "fixed" || style.animationName !== "none") continue;

      let depth = 0;
      let blocked = false;
      for (let parent = node.parentElement; parent && parent !== host; parent = parent.parentElement) {
        if (chosen.has(parent)) depth += 1;
        if (scrollsSideways(parent)) {
          blocked = true;
          break;
        }
      }
      if (blocked || depth > 2) continue;

      chosen.add(node);
      items.push({ el: node, nested: depth > 0 });
    }

    const meta = new Map<Element, { nested: boolean }>();
    for (const item of items) {
      meta.set(item.el, { nested: item.nested });
      item.el.setAttribute(WAIT, "");
    }

    const play = (el: HTMLElement, order: number) => {
      const info = meta.get(el);
      el.removeAttribute(WAIT);
      if (!info) return;
      const kind = kindOf(el);
      const canMove = getComputedStyle(el).transform === "none";
      const extra = Number(el.getAttribute("data-reveal-delay")) || 0;
      try {
        el.animate(frames(el, kind, info.nested, canMove), {
          duration: kind === "media" ? 1100 : kind === "heading" ? 900 : 760,
          delay: 40 + Math.min(order, 14) * 65 + extra,
          easing: EASE,
          fill: "backwards",
        });
      } catch {
        /* Older engines simply show the element. */
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        visible.forEach((el, index) => {
          observer.unobserve(el);
          play(el, index);
        });
      },
      { threshold: 0, rootMargin: "0px 0px -6% 0px" },
    );
    for (const item of items) observer.observe(item.el);

    return () => {
      observer.disconnect();
      for (const item of items) item.el.removeAttribute(WAIT);
    };
  }, [root]);
}

import { router } from "@inertiajs/react";

type Page = { component: string; props: { siteVersion?: string } };

const CHECK_EVERY = 4000;

/**
 * Keeps an open tab of the public site in step with the admin. When the tab
 * comes back into view, or the browser restores a page from its history, it
 * asks for the site version and fetches the page again if something was
 * published after the page was rendered.
 */
export function keepSiteFresh(initial: Page) {
  if (typeof window === "undefined" || window.parent !== window) return;
  let page = initial;
  let latest = versionOf(initial);
  let lastCheck = Date.now();
  let reloading = false;

  const refresh = () => {
    if (reloading || !watches(page) || versionOf(page) >= latest) return;
    reloading = true;
    router.reload({ onFinish: () => { reloading = false; } });
  };

  const check = async (force = false) => {
    if (!watches(page) || document.visibilityState !== "visible" || (!force && Date.now() - lastCheck < CHECK_EVERY)) return;
    lastCheck = Date.now();
    try {
      const response = await fetch("/site-version", { cache: "no-store", credentials: "omit", headers: { Accept: "application/json" } });
      const { version } = (await response.json()) as { version?: string };
      latest = Math.max(latest, Number(version) || 0);
      refresh();
    } catch {
      // Offline or between deploys: the next return to the tab asks again.
    }
  };

  const track = (next: Page) => {
    page = next;
    latest = Math.max(latest, versionOf(page));
    refresh();
  };
  // Reloads replace the history entry and only fire «success»; history restores only fire «navigate».
  router.on("success", (event) => track(event.detail.page as Page));
  router.on("navigate", (event) => track(event.detail.page as Page));
  document.addEventListener("visibilitychange", () => void check());
  window.addEventListener("focus", () => void check());
  window.addEventListener("popstate", () => void check(true));
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void check(true);
  });
}

function versionOf(page: Page) {
  return Number(page.props.siteVersion) || 0;
}

function watches(page: Page) {
  return !/^(Admin|Portal)\//.test(page.component);
}

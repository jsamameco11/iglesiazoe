import { router } from "@inertiajs/react";
import { useEffect } from "react";

/**
 * Panel links start loading the page while the pointer rests on them. The web-form
 * tabs stay out: opening one marks it as read, which must only happen on a real visit.
 */
export function panelPrefetch(href: string) {
  return href.startsWith("/admin/formularios/") ? {} : ({ prefetch: "hover", cacheFor: "10s" } as const);
}

/** Anything saved through the panel drops the pages loaded ahead, so none of them shows data from before the change. */
export function useFreshPrefetch() {
  useEffect(
    () =>
      router.on("finish", (event) => {
        if (event.detail.visit.method !== "get") router.flushAll();
      }),
    [],
  );
}

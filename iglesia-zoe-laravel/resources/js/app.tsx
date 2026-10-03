import { createInertiaApp } from "@inertiajs/react";
import type { ComponentType } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { keepSiteFresh } from "@/lib/site-version";

const pages = import.meta.glob<{ default: ComponentType }>("./Pages/**/*.tsx");

createInertiaApp({
  title: (title) => (title ? `${title} · Iglesia Cristiana Zoe` : "Iglesia Cristiana Zoe"),
  resolve: (name) => {
    const page = pages[`./Pages/${name}.tsx`];
    if (!page) throw new Error(`Missing Inertia page: ${name}`);
    return page().then((module) => module.default);
  },
  setup({ el, App, props }) {
    const skin = (props.initialPage.props as { skin?: string }).skin || "aire";
    document.documentElement.lang = "es";
    document.documentElement.dataset.skin = skin;
    keepSiteFresh(props.initialPage as Parameters<typeof keepSiteFresh>[0]);
    const app = <App {...props} />;
    if (el.hasChildNodes()) hydrateRoot(el, app);
    else createRoot(el).render(app);
  },
  progress: { color: "#C45C26" },
});

import { createInertiaApp } from "@inertiajs/react";
import type { ComponentType } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

const pages = import.meta.glob("./Pages/**/*.tsx", { eager: true }) as Record<
  string,
  { default: ComponentType }
>;

createInertiaApp({
  title: (title) => (title ? `${title} · Iglesia Cristiana Zoe` : "Iglesia Cristiana Zoe"),
  resolve: (name) => {
    const page = pages[`./Pages/${name}.tsx`];
    if (!page) throw new Error(`Missing Inertia page: ${name}`);
    return page;
  },
  setup({ el, App, props }) {
    const skin = (props.initialPage.props as { skin?: string }).skin || "aire";
    document.documentElement.lang = "es";
    document.documentElement.dataset.skin = skin;
    const app = <App {...props} />;
    if (el.hasChildNodes()) hydrateRoot(el, app);
    else createRoot(el).render(app);
  },
  progress: { color: "#C45C26" },
});

import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { Notice, PageHeader, button, ghost, useAction } from "@/Components/admin/ui";
import { ArtPanel } from "@/Components/admin/design/art-panel";
import { ContentPanel } from "@/Components/admin/design/content-panel";
import { Choice } from "@/Components/admin/design/fields";
import { GlobalPanel } from "@/Components/admin/design/global-panel";
import { LivePreview } from "@/Components/admin/design/live-preview";
import { PagePanel } from "@/Components/admin/design/page-panel";
import { useDraft } from "@/Components/admin/design/use-draft";
import { send } from "@/lib/actions";
import { can, usePanelUser } from "@/lib/access";
import type { ArtSpec, Design, DesignPage, FontOption, SectionInfo } from "@/lib/design";
import type { MediaAsset } from "@/lib/media";

type Tab = "global" | "page" | "content" | "art";

type Props = { stored: Design; mediaOverrides: Record<string, MediaAsset>; fonts: FontOption[]; pages: DesignPage[]; art: ArtSpec[] };

export default function Diseno({ stored, mediaOverrides, fonts, pages, art }: Props) {
  const user = usePanelUser();
  const draft = useDraft(stored);
  const [tab, setTab] = useState<Tab>("global");
  const [pageKey, setPageKey] = useState(pages[0]?.key ?? "Home");
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { result, setResult, pending, run } = useAction();
  const page = pages.find((item) => item.key === pageKey) ?? pages[0];

  function openPage(key: string) {
    setPageKey(key);
    setSection(null);
  }

  function pick(key: string) {
    setSection(key);
    setTab("page");
  }

  function publish() {
    run(() => send("/admin/diseno", { design: JSON.stringify(draft.design) }), () => router.reload({ only: ["stored", "design"] }));
  }

  function restore() {
    if (!window.confirm("¿Volver al diseño original de la web? Se quitan todos los colores, tipografías, tamaños y ajustes por página.")) return;
    run(() => send("/admin/diseno/restaurar", {}));
  }

  return (
    <AdminLayout>
      <div className="pb-24">
        <PageHeader
          kicker="Página web"
          title="Diseño de la página"
          text="Elige una página y cambia sus fondos (color, degradado, foto, GIF o video), colores, tipografías, secciones, fotos, textos y animaciones mirando la web real. El diseño no cambia para los visitantes hasta que publiques."
          aside={<button type="button" onClick={restore} className={ghost}>Restaurar original</button>}
        />

        <div className="mt-6 grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-8rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
            <Choice<Tab> value={tab} options={[{ key: "global", label: "Toda la web" }, { key: "page", label: "Página" }, { key: "content", label: "Contenido" }, { key: "art", label: "Ilustraciones" }]} onChange={setTab} />
            <div className="rounded-[1.6rem] border border-line bg-card p-5">
              {tab === "global" && <GlobalPanel draft={draft} fonts={fonts} />}
              {tab === "page" && page && <PagePanel draft={draft} page={page} sections={sections} section={section} onSection={setSection} />}
              {tab === "content" && page && <ContentPanel key={page.key} page={page} mediaOverrides={mediaOverrides} onSaved={() => setRefresh((value) => value + 1)} />}
              {tab === "art" && <ArtPanel draft={draft} specs={art} pages={pages} onShow={openPage} />}
            </div>
            {(can(user, "media.manage") || can(user, "content.manage")) && (
              <div className="grid gap-2">
                {can(user, "content.manage") && <Link href="/admin/textos" className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold transition hover:border-ink/30">Editar los textos de cada página →</Link>}
                {can(user, "media.manage") && <Link href="/admin/medios" className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold transition hover:border-ink/30">Cambiar fotos y videos →</Link>}
              </div>
            )}
          </aside>

          <div className="space-y-3 xl:sticky xl:top-6 xl:self-start">
            <label className="flex items-center gap-3 text-sm font-semibold text-ink">
              Página
              <select value={pageKey} onChange={(event) => openPage(event.target.value)} className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-ink/40 sm:max-w-xs">
                {pages.map((item) => (
                  <option key={item.key} value={item.key} disabled={!item.url}>
                    {item.label}{draft.design.pages[item.key] ? " •" : ""}
                  </option>
                ))}
              </select>
            </label>
            {page && <LivePreview page={page} design={draft.design} section={tab === "page" ? section : null} refresh={refresh} onSections={setSections} onPick={pick} />}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-5 py-3 backdrop-blur md:left-[272px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Notice result={result} onClose={() => setResult(null)} />
              {!result && <p className="text-sm text-muted">{draft.dirty ? "Tienes cambios sin publicar." : "Todo publicado."}</p>}
            </div>
            <div className="flex gap-2">
              {draft.dirty && <button type="button" onClick={draft.discard} className={ghost}>Descartar</button>}
              <button type="button" onClick={publish} disabled={pending || !draft.dirty} className={button}>{pending ? "Publicando…" : "Publicar en la web"}</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

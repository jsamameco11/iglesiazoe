import { Head, Link } from "@inertiajs/react";
import { AccesoGate } from "@/Components/auth/acceso-gate";
import { LoginForm } from "@/Components/auth/login-form";
import { WeeklyNoticeModal, type WeeklyNotice } from "@/Components/auth/weekly-notice";
import { SkinScroll } from "@/Components/site/skin-scroll";
import { useCopy } from "@/lib/copy";
import { section, useSiteDesign } from "@/lib/design";
import type { CSSProperties } from "react";

type Props = { next?: string; notice?: WeeklyNotice | null; preview?: { enabled: boolean } | null };

export default function Acceso({ next, notice, preview }: Props) {
  const { style, attrs } = useSiteDesign();
  const t = useCopy();
  return (
    <div data-skin="aire" {...attrs} className="relative grid min-h-screen items-start gap-8 bg-paper px-6 pt-10 pb-12 md:px-16 md:pt-12 md:pb-14 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-center lg:gap-12 lg:py-14" style={style as CSSProperties}>
      <Head title="Acceso al sistema" />
      <SkinScroll skin="aire" />
      {preview && (
        <div className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-ink px-4 py-2.5 text-center text-xs text-white">
          <span className="font-semibold">Vista previa de las indicaciones</span>
          <span className="text-white/60">{preview.enabled ? "Publicadas: así las ven los servidores." : "Ocultas: los servidores no las ven todavía."}</span>
          <Link href="/admin/indicaciones" className="font-semibold text-orange underline-offset-4 hover:underline">Volver al panel →</Link>
        </div>
      )}
      <div {...section("form", "Formulario de acceso")} className="relative w-full max-w-md">
        <Link href="/" className="acceso-brand">
          {t("acceso.brand")}
        </Link>
        <div className="mt-7">
          <LoginForm next={next} />
        </div>
        <p className="mt-8 text-sm leading-6 text-muted">
          <Link href="/" className="underline-offset-4 hover:underline">
            {t("acceso.back")}
          </Link>
        </p>
      </div>
      <AccesoGate />
      {notice && <WeeklyNoticeModal notice={notice} />}
    </div>
  );
}

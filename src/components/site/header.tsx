"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Ministry } from "@/lib/types";

const primary = [
  { href: "/conocenos", label: "Conócenos", note: "Historia y pastores" },
  { href: "/ministerios", label: "Ministerios", note: "Cada generación" },
  { href: "/bautismos", label: "Bautismo", note: "Tu nuevo comienzo" },
  { href: "/predicas", label: "Prédicas", note: "Mensajes y series" },
  { href: "/dar", label: "Dar", note: "Generosidad" },
  { href: "/contacto", label: "Oración", note: "Estamos contigo" },
];

function HeaderBar({
  ministries,
  home,
  other,
  onHero,
  lightCta,
  ghost,
  onOpenMenu,
}: {
  ministries: Ministry[];
  home: string;
  other?: { href: string; label: string };
  onHero: boolean;
  lightCta: boolean;
  ghost?: boolean;
  onOpenMenu?: () => void;
}) {
  const [ministriesOpen, setMinistriesOpen] = useState(false);

  return (
    <div className="flex h-[72px] items-center justify-between gap-6 px-5 md:px-10">
      <Link href={home} className="text-[1.05rem] font-semibold tracking-[-0.03em]" tabIndex={ghost ? -1 : undefined}>
        Iglesia Zoe
      </Link>
      <nav className={`hidden items-center gap-7 text-[13.5px] font-medium tracking-[-0.01em] lg:flex ${onHero ? "" : "text-[#8a8884]"}`}>
        <Link href="/conocenos" className="transition hover:opacity-60" tabIndex={ghost ? -1 : undefined}>Conócenos</Link>
        <div
          className="relative"
          onMouseEnter={() => !ghost && setMinistriesOpen(true)}
          onMouseLeave={() => setMinistriesOpen(false)}
        >
          <Link href="/ministerios" className="inline-flex items-center gap-1.5 transition hover:opacity-60" tabIndex={ghost ? -1 : undefined}>
            Ministerios
            <span className={`text-[9px] transition ${ministriesOpen ? "rotate-180" : ""}`}>▼</span>
          </Link>
          {!ghost && ministriesOpen && (
            <div className="absolute left-1/2 top-full w-[640px] -translate-x-1/2 pt-5 text-ink">
              <div className="overflow-hidden rounded-[1.6rem] border border-black/5 bg-[#fbfaf6] shadow-[0_30px_80px_rgba(23,24,28,0.12)]">
                <div className="flex items-end justify-between border-b border-black/5 px-6 py-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Crecer</p>
                    <p className="editorial mt-1 text-3xl italic">Un lugar para cada etapa</p>
                  </div>
                  <Link href="/ministerios" className="text-sm font-medium">Ver todos →</Link>
                </div>
                <div className="grid grid-cols-2 gap-px bg-black/5">
                  {ministries.map((ministry, index) => (
                    <Link key={ministry.slug} href={`/ministerios/${ministry.slug}`} className="bg-[#fbfaf6] px-6 py-5 transition hover:bg-[#f3efe7]">
                      <p className="text-[11px] tracking-[0.18em] text-muted">0{index + 1}</p>
                      <p className="mt-2 text-[1.35rem] font-medium tracking-[-0.03em]">{ministry.name}</p>
                      <p className="mt-1 text-sm text-muted">{ministry.age_range}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <Link href="/bautismos" className="transition hover:opacity-60" tabIndex={ghost ? -1 : undefined}>Bautismo</Link>
        <Link href="/predicas" className="transition hover:opacity-60" tabIndex={ghost ? -1 : undefined}>Prédicas</Link>
        <Link href="/contacto" className="transition hover:opacity-60" tabIndex={ghost ? -1 : undefined}>Oración</Link>
        <Link href="/dar" className="transition hover:opacity-60" tabIndex={ghost ? -1 : undefined}>Dar</Link>
      </nav>
      <div className="hidden items-center gap-5 lg:flex">
        {other && (
          <Link href={other.href} className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-55" tabIndex={ghost ? -1 : undefined}>
            {other.label}
          </Link>
        )}
        <Link
          href="/visita"
          tabIndex={ghost ? -1 : undefined}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold ${lightCta ? "bg-white text-ink" : "bg-ink text-white"}`}
        >
          Planifica tu visita
        </Link>
      </div>
      <button
        className="flex h-11 w-11 items-center justify-center rounded-full border border-current/20 lg:hidden"
        onClick={ghost ? undefined : onOpenMenu}
        tabIndex={ghost ? -1 : undefined}
        aria-label="Abrir menú"
      >
        <span className="flex flex-col gap-1.5">
          <span className={`block h-px w-5 ${onHero ? "bg-white" : "bg-ink"}`} />
          <span className={`block h-px w-5 ${onHero ? "bg-white" : "bg-ink"}`} />
        </span>
      </button>
    </div>
  );
}

export function Header({
  ministries,
  home = "/",
  other,
  overMedia,
}: {
  ministries: Ministry[];
  home?: string;
  other?: { href: string; label: string };
  overMedia?: boolean | "split";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const split = overMedia === "split";

  useEffect(() => {
    const onScroll = () => {
      const wide = window.innerWidth >= 1024;
      const limit = split
        ? wide ? window.innerHeight * 0.72 : window.innerHeight * 0.42
        : overMedia
          ? window.innerHeight * 0.72
          : 24;
      setScrolled(window.scrollY > limit);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [overMedia, split]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const onHero = Boolean(overMedia) && pathname === home && !scrolled && !open;

  const bar = {
    ministries,
    home,
    other,
    onHero,
    onOpenMenu: () => setOpen(true),
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {!onHero && scrolled && (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-16 bg-paper" />
      )}

      {split && onHero ? (
        <>
          <div className="text-white lg:hidden">
            <HeaderBar {...bar} lightCta />
          </div>
          <div className="hidden lg:block">
            <div className="pointer-events-none absolute inset-x-0 top-0 text-white" style={{ clipPath: "inset(0 47.5% 0 0)" }} aria-hidden>
              <HeaderBar {...bar} lightCta={false} ghost />
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 text-ink" style={{ clipPath: "inset(0 0 0 52.5%)" }} aria-hidden>
              <HeaderBar {...bar} lightCta={false} ghost />
            </div>
            <div className="relative text-transparent">
              <HeaderBar {...bar} lightCta={false} />
            </div>
          </div>
        </>
      ) : (
        <div className={onHero ? "text-white" : "text-ink"}>
          <HeaderBar {...bar} lightCta={onHero} />
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f4ee] text-ink">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col px-5 py-5 md:px-10">
            <div className="flex items-center justify-between">
              <p className="text-[1.05rem] font-semibold tracking-[-0.03em]">Iglesia Zoe</p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
                aria-label="Cerrar menú"
              >
                Cerrar
              </button>
            </div>
            <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1.15fr_0.85fr]">
              <nav>
                {primary.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-end justify-between gap-6 border-b border-ink/10 py-4"
                  >
                    <span className="text-[1.85rem] font-medium leading-none tracking-[-0.045em] md:text-[2.35rem]">
                      {item.label}
                    </span>
                    <span className="pb-1 text-right text-sm text-muted">{item.note}</span>
                  </Link>
                ))}
                <Link href={home} onClick={() => setOpen(false)} className="mt-5 inline-block text-sm font-medium text-muted">
                  Inicio
                </Link>
              </nav>
              <aside className="rounded-[1.8rem] bg-[#e7eee8] p-7 md:p-8">
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink/50">Siguiente paso</p>
                <p className="editorial mt-4 text-4xl italic leading-[1.05] md:text-5xl">
                  Te esperamos en casa.
                </p>
                <p className="mt-4 max-w-xs text-sm leading-6 text-ink/70">
                  Cuéntanos que vienes y un equipo de bienvenida estará atento.
                </p>
                <Link
                  href="/visita"
                  onClick={() => setOpen(false)}
                  className="mt-8 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
                >
                  Planifica tu visita
                </Link>
                <div className="mt-8 flex flex-col gap-2 text-sm">
                  <Link href="/ingresar" onClick={() => setOpen(false)} className="font-medium">Grupos celulares →</Link>
                  {other && (
                    <Link href={other.href} onClick={() => setOpen(false)} className="text-ink/55">
                      {other.label}
                    </Link>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import type { Ministry } from "@/lib/types";

const links = [
  { href: "/conocenos", label: "Conócenos" },
  { href: "/bautismos", label: "Bautismos" },
  { href: "/predicas", label: "Prédicas" },
  { href: "/dar", label: "Dar" },
  { href: "/contacto", label: "Contacto" },
];

export function Header({ ministries }: { ministries: Ministry[] }) {
  const [open, setOpen] = useState(false);
  const [ministriesOpen, setMinistriesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img src="/images/logo.png" alt="Iglesia Cristiana" className="h-7 w-auto" />
          <span className="text-2xl font-light tracking-tight">Zoe</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink xl:flex">
          <Link href="/" className="hover:text-orange-deep">Inicio</Link>
          {links.slice(0, 1).map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-orange-deep">{link.label}</Link>
          ))}
          <div
            className="relative"
            onMouseEnter={() => setMinistriesOpen(true)}
            onMouseLeave={() => setMinistriesOpen(false)}
          >
            <Link href="/ministerios" className="hover:text-orange-deep">Ministerios</Link>
            {ministriesOpen && (
              <div className="absolute left-1/2 top-full w-64 -translate-x-1/2 pt-3">
                <div className="rounded-2xl border border-line bg-card p-2 shadow-xl shadow-black/5">
                  {ministries.map((ministry) => (
                    <Link
                      key={ministry.slug}
                      href={`/ministerios/${ministry.slug}`}
                      className="block rounded-xl px-3 py-2.5 hover:bg-paper"
                    >
                      <span className="block text-sm font-medium">{ministry.name}</span>
                      <span className="block text-xs text-muted">{ministry.age_range}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {links.slice(1).map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-orange-deep">{link.label}</Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          <Link href="/ingresar" className="text-sm font-medium text-muted hover:text-ink">Grupos</Link>
          <Link href="/visita" className="whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black">
            Planifica tu visita
          </Link>
        </div>
        <button className="xl:hidden" onClick={() => setOpen((value) => !value)} aria-label="Abrir menú">
          <span className="block h-px w-6 bg-ink" />
          <span className="mt-1.5 block h-px w-6 bg-ink" />
          <span className="mt-1.5 block h-px w-4 bg-ink" />
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-paper px-5 py-4 xl:hidden">
          <div className="flex flex-col gap-3 text-lg font-light">
            <Link href="/" onClick={() => setOpen(false)}>Inicio</Link>
            <Link href="/conocenos" onClick={() => setOpen(false)}>Conócenos</Link>
            <Link href="/ministerios" onClick={() => setOpen(false)}>Ministerios</Link>
            {ministries.map((ministry) => (
              <Link key={ministry.slug} href={`/ministerios/${ministry.slug}`} onClick={() => setOpen(false)} className="pl-3 text-base text-muted">
                {ministry.name}
              </Link>
            ))}
            {links.slice(1).map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
            ))}
            <Link href="/ingresar" onClick={() => setOpen(false)}>Grupos celulares</Link>
            <Link href="/visita" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-ink px-4 py-3 text-center text-base font-medium text-white">
              Planifica tu visita
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

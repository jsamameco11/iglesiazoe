import type { Metadata } from "next";
import Link from "next/link";
import { AccesoGate } from "@/components/auth/acceso-gate";
import { LoginForm } from "@/components/auth/login-form";
import { SkinScroll } from "@/components/site/skin-scroll";

export const metadata: Metadata = { title: "Acceso al sistema" };

export default async function AccesoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div data-skin="aire" className="relative grid min-h-screen items-center gap-12 px-6 py-16 md:px-16 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <SkinScroll skin="aire" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="display text-5xl">Zoe</Link>
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
        <p className="mt-10 text-sm text-muted">
          <Link href="/" className="underline-offset-4 hover:underline">Volver al inicio</Link>
        </p>
      </div>
      <AccesoGate />
    </div>
  );
}

import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink px-5">
      <img src="/images/banner8.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="relative flex w-full max-w-5xl items-center justify-between gap-10">
        <div className="hidden text-white md:block">
          <p className="script text-7xl">Zoe</p>
          <p className="mt-2 text-3xl font-light">Iglesia Cristiana</p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { MediaView } from "@/components/site/media-view";
import { SkinScroll } from "@/components/site/skin-scroll";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const media = await getSiteMedia();
  return (
    <div data-skin="aire" className="relative grid min-h-screen items-center gap-12 px-6 py-16 md:px-16 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <SkinScroll skin="aire" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="display text-5xl">Zoe</Link>
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      </div>
      <MediaView
        asset={media.login}
        fit="raw"
        className="shot h-72 w-full object-cover lg:h-[72vh]"
      />
    </div>
  );
}

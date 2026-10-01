import type { Metadata } from "next";
import { MareaHome } from "@/propuestas/marea/home";
import { getMinistries, getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Propuesta Marea" };

export default async function MareaPage() {
  const [settings, ministries, media] = await Promise.all([getSettings(), getMinistries(), getSiteMedia()]);
  return <MareaHome settings={settings} ministries={ministries} media={media} />;
}

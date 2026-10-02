import { usePage } from "@inertiajs/react";
import type { SiteSettings } from "@/lib/types";

export type SocialNetwork = "instagram" | "facebook" | "youtube" | "tiktok";

type SocialSettings = Partial<Pick<SiteSettings, "instagram" | "facebook" | "youtube" | "tiktok" | "messengerUrl" | "liveUrl" | "whatsapp">>;

const networks: { id: SocialNetwork; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
];

export function socialLinksOf(settings: SocialSettings | undefined) {
  return networks
    .map((network) => ({ ...network, href: (settings?.[network.id] || "").trim() }))
    .filter((network) => network.href);
}

export function liveUrlOf(settings: SocialSettings | undefined) {
  return (settings?.liveUrl || "").trim() || (settings?.youtube || "").trim() || "https://www.youtube.com/@iglesiacristianazoe6279";
}

export function messengerUrlOf(settings: SocialSettings | undefined) {
  return (settings?.messengerUrl || "").trim();
}

export function whatsappUrlOf(settings: SocialSettings | undefined) {
  const digits = (settings?.whatsapp || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.length === 9 ? `51${digits}` : digits}`;
}

/** Best channel to write to the church with a ready message: WhatsApp, then Messenger, then the contact page. */
export function talkUrlOf(settings: SocialSettings | undefined, message: string) {
  const whatsapp = whatsappUrlOf(settings);
  if (whatsapp) return `${whatsapp}?text=${encodeURIComponent(message)}`;
  return messengerUrlOf(settings) || "/contacto";
}

export function useSocial() {
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  return {
    links: socialLinksOf(settings),
    live: liveUrlOf(settings),
    messenger: messengerUrlOf(settings),
    whatsapp: whatsappUrlOf(settings),
    talk: (message: string) => talkUrlOf(settings, message),
  };
}

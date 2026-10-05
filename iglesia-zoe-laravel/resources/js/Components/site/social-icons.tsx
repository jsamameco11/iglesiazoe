import type { SocialNetwork } from "@/lib/social";

export function SocialIcon({ id }: { id: SocialNetwork }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 4.9 3.6 9 8.3 9.7v-6.9H8v-2.8h2.5V9.9c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.45 2.8h-2.35v6.9c4.7-.7 8.3-4.8 8.3-9.7 0-5.4-4.4-9.8-9.8-9.8Z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.1 7.2a2.6 2.6 0 0 0-1.8-1.85C18.7 4.9 12 4.9 12 4.9s-6.7 0-8.3.45A2.6 2.6 0 0 0 1.9 7.2 27 27 0 0 0 1.45 12c0 1.65.15 3.25.45 4.8a2.6 2.6 0 0 0 1.8 1.85c1.6.45 8.3.45 8.3.45s6.7 0 8.3-.45a2.6 2.6 0 0 0 1.8-1.85c.3-1.55.45-3.15.45-4.8s-.15-3.25-.45-4.8ZM9.85 15.05v-6.1L15.4 12l-5.55 3.05Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 2.5h-3.3v13.1a2.85 2.85 0 1 1-2.85-2.85c.3 0 .58.04.85.12V9.5a6.2 6.2 0 1 0 5.3 6.12V9.06a7.9 7.9 0 0 0 4.6 1.47V7.25a4.6 4.6 0 0 1-4.6-4.6v-.15Z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2.2a9.77 9.77 0 0 0-8.4 14.78L2.2 21.8l4.95-1.4A9.78 9.78 0 1 0 12.04 2.2Zm0 17.86a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.94.83.86-2.86-.19-.3a8.1 8.1 0 1 1 6.7 3.64Zm4.44-6.06c-.24-.12-1.43-.7-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06a6.63 6.63 0 0 1-3.27-2.86c-.25-.42.25-.4.7-1.32.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.4h-.46a.88.88 0 0 0-.64.3 2.68 2.68 0 0 0-.84 2c0 1.18.86 2.32.98 2.48.12.16 1.7 2.6 4.12 3.64 1.53.66 2.13.72 2.9.6.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

import { useEffect, useRef, useState } from "react";
import type { CopyKey } from "@/lib/copy";
import { canShareFile, copyText, fetchImageFile, isAppleMobile, saveFile, whatsappLink } from "@/lib/share";
import type { DevotionalFull } from "@/lib/types";

type Status = "idle" | "preparing" | "attach" | "copied" | "saved";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88Zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M10 14a4.5 4.5 0 0 0 6.36 0l3.18-3.18a4.5 4.5 0 0 0-6.36-6.36l-1.06 1.06" />
      <path d="M14 10a4.5 4.5 0 0 0-6.36 0l-3.18 3.18a4.5 4.5 0 0 0 6.36 6.36l1.06-1.06" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * Share card of a devotional. WhatsApp gets the square picture together with the verse
 * and the link: phones send both at once through the share sheet; computers download
 * the picture and open WhatsApp with the message ready, so it only has to be attached.
 */
export function DevotionalShare({ devotional, t }: { devotional: DevotionalFull; t: (key: CopyKey) => string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number>(0);
  const fileName = `devocional-${devotional.slug}.jpg`;

  useEffect(() => {
    let alive = true;
    setFile(null);
    fetchImageFile(devotional.share_image, fileName).then((ready) => alive && setFile(ready));
    return () => {
      alive = false;
      window.clearTimeout(timer.current);
    };
  }, [devotional.share_image, fileName]);

  function show(next: Status, ms = 0) {
    window.clearTimeout(timer.current);
    setStatus(next);
    if (ms) timer.current = window.setTimeout(() => setStatus("idle"), ms);
  }

  function link() {
    return `${window.location.origin}/devocionales/${devotional.slug}`;
  }

  function message() {
    const verse = devotional.verse_text ? `_«${devotional.verse_text.trim()}»_${devotional.verse_ref ? `\n${devotional.verse_ref}` : ""}` : devotional.verse_ref || "";
    return [`*${devotional.title}*`, verse, `${t("devotionals.shareText")}\n${link()}`].filter(Boolean).join("\n\n");
  }

  async function picture() {
    if (file) return file;
    show("preparing");
    const ready = await fetchImageFile(devotional.share_image, fileName);
    if (ready) setFile(ready);
    return ready;
  }

  function shareWhatsapp() {
    const text = message();
    if (file && canShareFile(file)) {
      if (!isAppleMobile()) saveFile(file);
      navigator.share({ files: [file], text }).catch((error: unknown) => {
        if ((error as DOMException)?.name !== "AbortError") window.location.href = whatsappLink(text);
      });
      return;
    }

    if (file) saveFile(file);
    window.open(whatsappLink(text), "_blank", "noopener");
    if (file) {
      show("attach", 9000);
      return;
    }
    picture().then((ready) => {
      if (ready) {
        saveFile(ready);
        show("attach", 9000);
      } else {
        show("idle");
      }
    });
  }

  async function download() {
    const ready = await picture();
    if (ready) {
      saveFile(ready);
      show("saved", 2600);
    } else {
      show("idle");
    }
  }

  async function copyLink() {
    if (await copyText(link())) show("copied", 2400);
  }

  return (
    <div className="devo-share">
      <p className="devo-share-title">{t("devotionals.shareTitle")}</p>
      <p className="devo-share-hint">{t("devotionals.shareHint")}</p>
      <button type="button" onClick={shareWhatsapp} className="devo-share-main btn-accent">
        <WhatsAppIcon />
        {t("devotionals.share")}
      </button>
      <div className="devo-share-row">
        <button type="button" onClick={copyLink} className="devo-share-alt" data-done={status === "copied" || undefined}>
          {status === "copied" ? <CheckIcon /> : <LinkIcon />}
          {status === "copied" ? t("devotionals.copied") : t("devotionals.copy")}
        </button>
        <button type="button" onClick={download} disabled={status === "preparing"} className="devo-share-alt" data-done={status === "saved" || undefined}>
          {status === "saved" ? <CheckIcon /> : <DownloadIcon />}
          {t("devotionals.download")}
        </button>
      </div>
      <p className="devo-share-notice" aria-live="polite">
        {status === "attach" ? t("devotionals.attach") : ""}
      </p>
    </div>
  );
}

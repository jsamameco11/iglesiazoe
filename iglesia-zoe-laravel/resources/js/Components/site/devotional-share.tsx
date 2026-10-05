import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "@/Components/site/social-icons";
import type { CopyKey } from "@/lib/copy";
import { canShareFile, copyText, fetchImageFile, isAppleMobile, saveFile, whatsappLink } from "@/lib/share";
import type { DevotionalFull } from "@/lib/types";

type Status = "idle" | "preparing" | "attach" | "copied" | "saved";

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
        <WhatsAppIcon className="-my-0.5 h-[22px] w-[22px] shrink-0" />
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

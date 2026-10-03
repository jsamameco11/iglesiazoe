/** Downloads a picture from the site and keeps it as a file ready to share. */
export async function fetchImageFile(src: string, name: string): Promise<File | null> {
  try {
    const response = await fetch(src, { credentials: "same-origin" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export function saveFile(file: File) {
  const href = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = href;
  link.download = file.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 4000);
}

export function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Phones and tablets, where the system share sheet can send a picture straight to WhatsApp. */
export function canShareFile(file: File) {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

export function whatsappLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Copies text even where the async clipboard is unavailable (plain http, older phones). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

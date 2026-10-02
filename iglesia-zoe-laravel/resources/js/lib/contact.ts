export function mapEmbedUrl(address: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;
}

export function telHref(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  return `tel:+${digits.startsWith("51") ? digits : `51${digits}`}`;
}

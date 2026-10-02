export function mapEmbedUrl(address: string) {
  const place = address ? `Iglesia Cristiana Zoe, ${address}` : "Iglesia Cristiana Zoe, Chiclayo";
  return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&z=17&output=embed`;
}

export function telHref(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  return `tel:+${digits.startsWith("51") ? digits : `51${digits}`}`;
}

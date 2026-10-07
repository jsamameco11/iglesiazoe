export function mapEmbedUrl(address: string) {
  const place = address ? `Iglesia Cristiana Zoe, ${address}` : "Iglesia Cristiana Zoe, Chiclayo";
  return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&z=17&output=embed`;
}

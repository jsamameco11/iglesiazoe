import { headers } from "next/headers";

export function hostFromHeaders(requestHeaders: Headers) {
  const forwarded = (requestHeaders.get("x-forwarded-host") || "").split(",")[0].trim();
  const host = (requestHeaders.get("host") || "").trim();
  return (forwarded || host).toLowerCase();
}

export function isLuzHost(requestHeaders: Headers) {
  const candidates = [
    requestHeaders.get("x-forwarded-host") || "",
    requestHeaders.get("host") || "",
  ]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return candidates.some((host) => host.startsWith("iglesiacristianazoe2.") || host.includes("iglesiacristianazoe2."));
}

export async function getSiteSkin() {
  return isLuzHost(await headers()) ? "marea" : "aire";
}

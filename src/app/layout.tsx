import type { Metadata } from "next";
import { Caveat, Instrument_Serif, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: {
    default: "Iglesia Cristiana Zoe",
    template: "%s · Iglesia Cristiana Zoe",
  },
  description:
    "Tu iglesia local en Chiclayo, donde la atmósfera de Dios se manifiesta en amor.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get("host") || "";
  const skin = host.toLowerCase().startsWith("iglesiacristianazoe2.") ? "marea" : "aire";
  return (
    <html lang="es" data-skin={skin} className={`${manrope.variable} ${instrument.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}

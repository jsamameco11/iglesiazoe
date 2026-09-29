import type { Metadata } from "next";
import { Allura, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
});

const allura = Allura({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-allura",
});

export const metadata: Metadata = {
  title: {
    default: "Iglesia Cristiana Zoe",
    template: "%s · Iglesia Cristiana Zoe",
  },
  description:
    "Tu iglesia local en Chiclayo, donde la atmósfera de Dios se manifiesta en amor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${allura.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import { DynamicMarker } from "@/components/dynamic-marker";
import { withBasePath } from "@/lib/base-path";
import { t } from "@/lib/i18n";
import { requestLang } from "@/lib/i18n/server";

import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLang();
  const title = t(lang, "meta.title");
  return {
    // Origine pubblica per i link assoluti di OG/icone (il basePath va prefissato a mano sui path assoluti).
    metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
    title,
    description: t(lang, "meta.description"),
    applicationName: "Bazaar",
    // Immagini generate da route handler (/brand/*): con basePath i link vanno prefissati a mano.
    icons: {
      icon: [{ url: withBasePath("/icon.svg"), type: "image/svg+xml" }],
      apple: [{ url: withBasePath("/brand/apple-icon"), sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      siteName: "Bazaar",
      title,
      description: t(lang, "meta.ogDescription"),
      images: [{ url: withBasePath("/brand/og"), width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", images: [withBasePath("/brand/og")] },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it">
      <body
        className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        {children}
        <DynamicMarker />
      </body>
    </html>
  );
}

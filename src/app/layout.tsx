import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import { withBasePath } from "@/lib/base-path";

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

export const metadata: Metadata = {
  // Origine pubblica per i link assoluti di OG/icone (il basePath va prefissato a mano sui path assoluti).
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
  title: "Bazaar — il fiuto giusto per ogni affare",
  description:
    "Il personal shopper con il fiuto per gli affari: cerca su Amazon, eBay, AliExpress, Vinted, Subito e Facebook Marketplace in un'unica chat, confronta prezzi reali e ti dice dove costa meno.",
  applicationName: "Bazaar",
  // Immagini generate da route handler (/brand/*): con basePath i link vanno prefissati a mano.
  icons: {
    icon: [{ url: withBasePath("/icon.svg"), type: "image/svg+xml" }],
    apple: [{ url: withBasePath("/brand/apple-icon"), sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Bazaar",
    title: "Bazaar — il fiuto giusto per ogni affare",
    description: "Il personal shopper che confronta prezzi reali su più marketplace e ti dice dove costa meno.",
    images: [
      {
        url: withBasePath("/brand/og"),
        width: 1200,
        height: 630,
        alt: "Bazaar — il fiuto giusto per ogni affare",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: [withBasePath("/brand/og")] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it">
      <body
        className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { HomeClient } from "@/components/home-client";
import { Landing } from "@/components/landing/landing";
import { resolveSession } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";

const TITLE = "Bazaar: il fiuto giusto per ogni affare";
const DESCRIPTION =
  "Scrivi cosa cerchi: Fiuto fa il giro di Amazon, AliExpress, Vinted e Subito.it, legge gli annunci e ti dice dove costa meno. Una chat sola, link diretti, nessuna carta.";

// Unica pagina anonima indicizzabile. Chi ha una sessione vede l'app (che non è nei motori di ricerca).
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Bazaar",
    locale: "it_IT",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: withBasePath("/brand/og"), width: 1200, height: 630, alt: "Bazaar: il fiuto giusto per ogni affare" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [withBasePath("/brand/og")] },
};

// La verifica vera avviene qui, lato server: il proxy lascia passare "/" e decide questa pagina.
async function Gate() {
  const result = await resolveSession(await headers());
  if (result.denied) redirect("/login?error=not_allowed");
  if (!result.user) return <Landing />;
  return <HomeClient user={result.user} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <Gate />
    </Suspense>
  );
}

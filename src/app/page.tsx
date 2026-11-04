import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DynamicMarker } from "@/components/dynamic-marker";
import { HomeClient } from "@/components/home-client";
import { Landing } from "@/components/landing/landing";
import { resolveSession } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";
import { LOCALES, t } from "@/lib/i18n";
import { requestLang } from "@/lib/i18n/server";

// Unica pagina anonima indicizzabile. Chi ha una sessione vede l'app (che non è nei motori di ricerca).
// Titolo e descrizione seguono la lingua della richiesta (cookie scelto o Accept-Language).
export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLang();
  const title = t(lang, "lp.metaTitle");
  const description = t(lang, "lp.metaDescription");
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: "Bazaar",
      locale: LOCALES[lang].replace("-", "_"),
      title,
      description,
      images: [{ url: withBasePath("/brand/og"), width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [withBasePath("/brand/og")] },
  };
}

// La verifica vera avviene qui, lato server: il proxy lascia passare "/" e decide questa pagina.
async function Gate() {
  const [result, lang] = await Promise.all([resolveSession(await headers()), requestLang()]);
  if (result.denied) redirect("/login?error=not_allowed");
  if (!result.user) return <Landing lang={lang} />;
  return <HomeClient user={result.user} initialLang={lang} />;
}

export default function Home() {
  return (
    <>
      <Suspense fallback={<div className="h-dvh bg-paper" />}>
        <Gate />
      </Suspense>
      <DynamicMarker />
    </>
  );
}

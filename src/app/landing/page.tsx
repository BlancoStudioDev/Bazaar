import type { Metadata } from "next";
import { Suspense } from "react";

import { Landing } from "@/components/landing/landing";
import { t } from "@/lib/i18n";
import { requestLang } from "@/lib/i18n/server";

// Anteprima sempre pubblica della landing (anche con auth disattiva). Non indicizzata: la copia canonica è `/`.
export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await requestLang(), "lp.metaTitle"), robots: { index: false, follow: false } };
}

async function Content() {
  return <Landing lang={await requestLang()} />;
}

export default function LandingPreview() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <Content />
    </Suspense>
  );
}

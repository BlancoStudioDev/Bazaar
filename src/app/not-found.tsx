import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Mascot } from "@/components/brand/mascot";
import { t } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { requestLang } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await requestLang(), "nf.metaTitle"), robots: { index: false, follow: false } };
}

async function Content() {
  const lang = await requestLang();
  return (
    <I18nProvider lang={lang}>
      <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-6 py-16">
        <Mascot mood="confused" size={168} animated />
        <p className="meta mt-8 uppercase">{t(lang, "nf.code")}</p>
        <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-[-0.03em] text-ink">
          {t(lang, "nf.title1")} <span className="italic text-accent">{t(lang, "nf.title2")}</span>
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{t(lang, "nf.body")}</p>
        <Link href="/login" className="btn-quiet mt-8 self-start">
          {t(lang, "nf.cta")}
        </Link>
      </main>
    </I18nProvider>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
      <Content />
    </Suspense>
  );
}

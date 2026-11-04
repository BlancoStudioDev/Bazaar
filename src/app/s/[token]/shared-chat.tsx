import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Mascot, MascotBadge } from "@/components/brand/mascot";
import { SharedBoard } from "@/app/s/[token]/shared-board";
import { SharedMarkdown } from "@/app/s/[token]/shared-markdown";
import { t as translate, type Lang, type TKey, type TVars } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import type { ShareSnapshot } from "@/lib/share/snapshot";
import { formatDate } from "@/lib/ui";

export function SharedChat({
  snapshot,
  sharedAt,
  lang,
}: {
  snapshot: ShareSnapshot;
  sharedAt: number;
  lang: Lang;
}) {
  const { title, messages, products } = snapshot;
  const t = (key: TKey, vars?: TVars) => translate(lang, key, vars);

  return (
    <I18nProvider lang={lang}>
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[760px] items-center justify-between gap-3 px-4 sm:px-6">
          <Logo tone="dark" size={30} />
          <div className="flex items-center gap-2">
            <SharedBoard products={products} />
            <Link href="/login" className="btn-quiet">
              <span className="sm:hidden">{t("sp.tryShort")}</span>
              <span className="hidden sm:inline">{t("sp.cta")}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <p className="meta uppercase">{t("sp.label")}</p>
        <h1 className="mt-3 text-balance font-serif text-[clamp(32px,6vw,48px)] font-normal leading-[1.02] tracking-[-0.03em] text-ink [overflow-wrap:anywhere]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          {t("sp.sharedOn", { date: formatDate(sharedAt, lang) })}
        </p>

        <div className="mt-10 space-y-8">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div key={index} className="flex justify-end">
                <div className="max-w-[86%] sm:max-w-[78%]">
                  <div className="whitespace-pre-wrap rounded-[18px] rounded-br-md bg-ink px-4 py-3 text-[14px] leading-relaxed text-paper [overflow-wrap:anywhere]">
                    {message.content}
                  </div>
                </div>
              </div>
            ) : (
              <div key={index}>
                <div className="mb-2 flex items-center gap-2">
                  <MascotBadge size={28} />
                  <span className="text-[13px] font-semibold text-ink">Bazaar</span>
                </div>
                <div className="sm:pl-8">
                  <SharedMarkdown>{message.content}</SharedMarkdown>
                </div>
              </div>
            ),
          )}
        </div>

        <p className="mt-10 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
          {t("sp.footer")}
        </p>

        <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-card px-5 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
          <Mascot mood="happy" size={112} animated className="sm:order-2" />
          <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[28px] leading-[1.05] tracking-[-0.02em] text-ink">
            {t("sp.ctaTitle1")} <span className="italic text-accent">{t("sp.ctaTitle2")}</span>
          </h2>
          <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-ink-2">
            {t("sp.ctaBody")}
          </p>
          <Link href="/login" className="btn-quiet mt-4">
            {t("sp.cta")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          </div>
        </section>
      </main>
    </div>
    </I18nProvider>
  );
}

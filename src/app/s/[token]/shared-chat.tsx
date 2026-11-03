import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { SharedBoard } from "@/app/s/[token]/shared-board";
import { SharedMarkdown } from "@/app/s/[token]/shared-markdown";
import type { ShareSnapshot } from "@/lib/share/snapshot";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(timestamp);
}

export function SharedChat({ snapshot, sharedAt }: { snapshot: ShareSnapshot; sharedAt: number }) {
  const { title, messages, products } = snapshot;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[760px] items-center justify-between gap-3 px-4 sm:px-6">
          <span className="font-serif text-[26px] leading-none tracking-[-0.02em] text-ink">Bazaar</span>
          <div className="flex items-center gap-2">
            <SharedBoard products={products} />
            <Link href="/login" className="btn-quiet">
              <span className="sm:hidden">Prova Bazaar</span>
              <span className="hidden sm:inline">Cerca anche tu su Bazaar</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <p className="meta uppercase">Chat condivisa · sola lettura</p>
        <h1 className="mt-3 text-balance font-serif text-[clamp(32px,6vw,48px)] font-normal leading-[1.02] tracking-[-0.03em] text-ink [overflow-wrap:anywhere]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Condivisa il <time dateTime={new Date(sharedAt).toISOString()}>{formatDate(sharedAt)}</time>
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
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper">
                    <Sparkles className="h-3 w-3" aria-hidden />
                  </span>
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
          Chat condivisa · sola lettura · i prezzi possono essere cambiati. Verifica sempre sull&apos;annuncio.
        </p>

        <section className="mt-8 rounded-2xl border border-line bg-card px-5 py-6 sm:px-6">
          <h2 className="font-serif text-[28px] leading-[1.05] tracking-[-0.02em] text-ink">
            Cerca anche tu, <span className="italic text-accent">senza girare i marketplace</span>
          </h2>
          <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-ink-2">
            Bazaar confronta Amazon, Vinted, Subito e altri in un&apos;unica chat e ti mostra dove costa meno.
          </p>
          <Link href="/login" className="btn-quiet mt-4">
            Cerca anche tu su Bazaar
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </main>
    </div>
  );
}

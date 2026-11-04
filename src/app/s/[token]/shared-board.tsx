"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, PanelRight, X } from "lucide-react";

import { MARKETPLACES, MARKETPLACE_IDS } from "@/lib/marketplaces";
import type { SharedProduct } from "@/lib/share/snapshot";
import { MarketplaceDot } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { cn, conditionLabel, displayPrice, truncate } from "@/lib/ui";

function SharedProductRow({ product }: { product: SharedProduct }) {
  const { lang } = useT();
  const [failed, setFailed] = useState(false);
  const meta = MARKETPLACES[product.marketplace];
  const price = displayPrice(product, lang);
  const detail = product.condition ? conditionLabel(product.condition, lang) : product.location;
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      referrerPolicy="no-referrer"
      className="group flex min-h-[72px] gap-3 rounded-xl p-2 transition hover:bg-card"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper-2">
        {product.image && !failed ? (
          <img
            src={product.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain p-1"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="font-serif text-2xl text-ink/30">
            {meta?.shortLabel.slice(0, 1) || "?"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">
            {price}
          </span>
          <ExternalLink
            className="h-4 w-4 shrink-0 self-center text-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        </div>
        <p className="line-clamp-2 text-[13px] leading-[1.35] text-ink">
          {product.title}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: meta?.color || "#888" }}
            aria-hidden
          />
          <span className="truncate">
            {meta?.shortLabel || product.marketplace}
            {detail ? ` · ${truncate(detail, 28)}` : ""}
          </span>
        </p>
      </div>
    </a>
  );
}

/** Bacheca statica: pulsante + pannello a scorrimento con elenco ordinato per prezzo. */
export function SharedBoard({ products }: { products: SharedProduct[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | string>("all");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products)
      map.set(p.marketplace, (map.get(p.marketplace) || 0) + 1);
    return map;
  }, [products]);

  const list = useMemo(() => {
    const base =
      filter === "all"
        ? products
        : products.filter((p) => p.marketplace === filter);
    const rank = (p: SharedProduct) =>
      p.price != null && p.price > 0 ? p.price : Number.POSITIVE_INFINITY;
    return [...base].sort((a, b) => rank(a) - rank(b));
  }, [filter, products]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  if (!products.length) return null;
  const sources = counts.size;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="btn-quiet"
        aria-label={t("app.boardAria", { count: products.length })}
        aria-haspopup="dialog"
      >
        <PanelRight className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t("app.board")}</span>
        <span className="font-mono text-[12px] text-muted">
          {products.length}
        </span>
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex justify-end">
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-ink/40 animate-fade-in"
                aria-label={t("app.closeBoard")}
                tabIndex={-1}
                onClick={() => setOpen(false)}
              />
              <div className="relative z-10 h-full w-[92vw] max-w-[400px] animate-slide-left">
                <aside
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("app.board")}
                  className="results-board is-mobile"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line px-4 pb-4 pt-4">
                    <div>
                      <h2 className="font-serif text-[28px] leading-none text-ink">
                        {t("app.board")}
                      </h2>
                      <p className="mt-2 text-[12px] text-muted">
                        {t("board.summary", {
                          products: t("board.products", { count: products.length }),
                          sources: t("board.sources", { count: sources }),
                        })}
                      </p>
                    </div>
                    <button
                      ref={closeRef}
                      type="button"
                      onClick={() => setOpen(false)}
                      className="icon-btn"
                      aria-label={t("app.closeBoard")}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="border-b border-line px-4 py-3">
                    <div
                      className="scrollbar-none flex gap-2 overflow-x-auto"
                      role="group"
                      aria-label={t("board.filterAria")}
                    >
                      <button
                        type="button"
                        onClick={() => setFilter("all")}
                        aria-pressed={filter === "all"}
                        className={cn(
                          "filter-chip",
                          filter === "all" && "is-active",
                        )}
                      >
                        {t("board.all")}
                      </button>
                      {MARKETPLACE_IDS.filter((id) => counts.get(id)).map(
                        (id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setFilter(id)}
                            aria-pressed={filter === id}
                            className={cn(
                              "filter-chip",
                              filter === id && "is-active",
                            )}
                          >
                            <MarketplaceDot id={id} size={8} />
                            {MARKETPLACES[id].shortLabel}
                            <span className="font-mono text-[11px] opacity-60">
                              {counts.get(id)}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                    <p className="mt-2 text-[12px] text-muted">
                      {t("board.sortedAsc")}
                    </p>
                  </div>

                  <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
                    {list.map((product) => (
                      <SharedProductRow key={product.url} product={product} />
                    ))}
                  </div>

                  <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-muted">
                    {t("board.sharedDisclaimer")}
                  </p>
                </aside>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

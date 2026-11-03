"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { MARKETPLACES, MARKETPLACE_IDS } from "@/lib/marketplaces";
import { dropSuspiciousPrices } from "@/lib/mcp/plausibility";
import { ProductCard } from "@/components/product-card";
import { MarketplaceDot, Spinner } from "@/components/ui";
import type { BazaarStore } from "@/lib/use-bazaar";
import type { MarketplaceId, Product } from "@/lib/types";
import { cn } from "@/lib/ui";

type SortMode = "price-asc" | "price-desc" | "source";

function collectProducts(store: BazaarStore): Product[] {
  const messages = store.activeConversation?.messages || [];
  const map = new Map<string, Product>();
  for (const message of messages) {
    for (const product of message.products || []) {
      const key = product.url || product.key;
      if (!map.has(key)) map.set(key, product);
    }
  }
  // Rete di sicurezza: prodotti salvati prima del filtro server con prezzi irrisori.
  return dropSuspiciousPrices(Array.from(map.values()));
}

export function ResultsBoard({
  store,
  onClose,
  mobile = false,
}: {
  store: BazaarStore;
  onClose?: () => void;
  mobile?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | MarketplaceId>("all");
  const [sort, setSort] = useState<SortMode>("price-asc");

  const products = useMemo(() => collectProducts(store), [store.activeConversation]);
  const counts = useMemo(() => {
    const map = new Map<MarketplaceId, number>();
    for (const product of products) {
      map.set(product.marketplace, (map.get(product.marketplace) || 0) + 1);
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? products : products.filter((product) => product.marketplace === filter);
    return [...list].sort((a, b) => {
      if (sort === "source") {
        return a.marketplace.localeCompare(b.marketplace) || (a.price ?? Infinity) - (b.price ?? Infinity);
      }
      const priceA = a.price != null && a.price > 0 ? a.price : Number.POSITIVE_INFINITY;
      const priceB = b.price != null && b.price > 0 ? b.price : Number.POSITIVE_INFINITY;
      return sort === "price-asc" ? priceA - priceB : priceB - priceA;
    });
  }, [filter, products, sort]);

  const sources = new Set(products.map((product) => product.marketplace)).size;
  const sortLabel =
    sort === "price-asc" ? "Prezzo crescente" : sort === "price-desc" ? "Prezzo decrescente" : "Per fonte";

  return (
    <aside className={cn("results-board", mobile && "is-mobile")} aria-label="Bacheca">
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 pb-4 pt-4">
        <div>
          <h2 className="font-serif text-[28px] leading-none text-ink">Bacheca</h2>
          <p className="mt-2 text-[12px] text-muted">
            {products.length
              ? `${products.length} ${products.length === 1 ? "prodotto" : "prodotti"} da ${sources} ${sources === 1 ? "fonte" : "fonti"}`
              : "Qui trovi i prodotti delle tue ricerche"}
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Chiudi bacheca">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {products.length ? (
        <>
          <div className="border-b border-line px-4 py-3">
            <div className="scrollbar-none flex gap-2 overflow-x-auto" role="group" aria-label="Filtra per fonte">
              <button
                type="button"
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
                className={cn("filter-chip", filter === "all" && "is-active")}
              >
                Tutti
              </button>
              {MARKETPLACE_IDS.filter((id) => counts.get(id)).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={cn("filter-chip", filter === id && "is-active")}
                >
                  <MarketplaceDot id={id} size={8} />
                  {MARKETPLACES[id].shortLabel}
                  <span className="font-mono text-[11px] opacity-60">{counts.get(id)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setSort((current) =>
                  current === "price-asc" ? "price-desc" : current === "price-desc" ? "source" : "price-asc",
                )
              }
              className="mt-2 inline-flex min-h-10 items-center text-[12px] text-muted transition hover:text-ink"
              aria-label={`Ordinamento: ${sortLabel}. Cambia`}
            >
              Ordina: <span className="ml-1 text-ink">{sortLabel}</span>
            </button>
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
            {filtered.map((product) => (
              <ProductCard key={product.key} product={product} />
            ))}
          </div>

          <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-muted">
            Prezzi come indicati dai marketplace. Verifica sempre sull&apos;annuncio.
          </p>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
          {store.isStreaming ? (
            <>
              <Spinner className="h-5 w-5 text-accent" />
              <p className="mt-4 text-[13px] text-ink">Sto raccogliendo i prodotti…</p>
            </>
          ) : (
            <>
              <p className="text-[14px] text-ink">Nessun prodotto, per ora</p>
              <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-muted">
                Cerca qualcosa in chat: i risultati compaiono qui, ordinati per prezzo.
              </p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

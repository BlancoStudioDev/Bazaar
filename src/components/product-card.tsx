"use client";

import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";

import { MARKETPLACES, productHref } from "@/lib/marketplaces";
import type { Product } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import { cn, conditionLabel, displayPrice, truncate } from "@/lib/ui";

function ProductImage({
  product,
  className,
  imageClassName,
}: {
  product: Product;
  className?: string;
  imageClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const meta = MARKETPLACES[product.marketplace];
  const showImage = product.image && !failed;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-paper-2",
        className,
      )}
    >
      {showImage ? (
        <img
          src={product.image || ""}
          alt={product.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn("h-full w-full object-contain p-1", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
        >
          <span className="font-serif text-2xl text-ink/30">{meta?.shortLabel?.slice(0, 1) || "?"}</span>
        </div>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { lang } = useT();
  const price = displayPrice(product, lang);
  const meta = MARKETPLACES[product.marketplace];
  const base = product.condition ? conditionLabel(product.condition, lang) : product.location;
  // Comparatori: il «venditore» è il negozio che offre il prezzo.
  const shop = meta?.tag === "confronto" ? product.seller : null;
  const detail = [base, shop].filter(Boolean).join(" · ") || null;

  return (
    <a
      href={productHref(product)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-[72px] gap-3 rounded-xl p-2 transition hover:bg-card"
    >
      <ProductImage
        product={product}
        className="h-14 w-14 shrink-0 rounded-lg border border-line"
        imageClassName="p-1"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">{price}</span>
          <ExternalLink
            className="h-4 w-4 shrink-0 self-center text-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        </div>
        <p className="line-clamp-2 text-[13px] leading-[1.35] text-ink">{product.title}</p>
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

/**
 * In chat non si ripete la tabella: un solo invito discreto ad aprire la bacheca.
 */
export function ProductStrip({
  products,
  onOpenResults,
}: {
  products: Product[];
  onOpenResults?: () => void;
}) {
  const { t } = useT();
  if (!products.length || !onOpenResults) return null;
  return (
    <button
      type="button"
      onClick={onOpenResults}
      className="btn-quiet mt-4"
    >
      {t("board.open", { products: t("board.products", { count: products.length }) })}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";

import { MARKETPLACES } from "@/lib/marketplaces";
import type { MarketplaceId } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import { cn, clamp, scoreTone } from "@/lib/ui";

export function MarketplaceDot({
  id,
  size = 8,
  muted = false,
}: {
  id: MarketplaceId | string;
  size?: number;
  muted?: boolean;
}) {
  const color = MARKETPLACES[id as MarketplaceId]?.color || "#8a8378";
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", muted && "opacity-30")}
      style={{ width: size, height: size, backgroundColor: color }}
      aria-hidden
    />
  );
}

export function MarketplaceBadge({
  id,
  className,
}: {
  id: MarketplaceId | string;
  className?: string;
}) {
  const meta = MARKETPLACES[id as MarketplaceId];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        className,
      )}
      style={{ backgroundColor: meta.color, color: meta.textColor }}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
      {meta.shortLabel}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden />;
}

export function ScoreBar({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  const tone = scoreTone(value);
  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-1.5")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-muted", "text-[11px]")}>{label}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            "text-[11px]",
            tone === "good" && "text-emerald-700",
            tone === "mid" && "text-amber-700",
            tone === "low" && "text-rose-700",
          )}
        >
          {Math.round(value)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-ink/8">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            tone === "good" && "bg-emerald-600",
            tone === "mid" && "bg-amber-500",
            tone === "low" && "bg-rose-500",
          )}
          style={{ width: `${clamp(value, 0, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  width?: string;
}) {
  const { t } = useT();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink/35 animate-fade-in"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line bg-paper shadow-[0_24px_64px_rgba(23,21,18,0.22)] animate-sheet-up sm:rounded-[24px]",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-line px-4 py-4 sm:px-6">
          <div>
            {eyebrow ? (
              <p className="meta mb-1 uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="font-serif text-[28px] leading-none tracking-[-0.02em] text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn shrink-0"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/50 px-4 py-8 text-center text-[13px] text-muted">
      {children}
    </div>
  );
}

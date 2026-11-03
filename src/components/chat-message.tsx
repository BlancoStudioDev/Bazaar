"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  Square,
  WifiOff,
} from "lucide-react";

import { MascotBadge } from "@/components/brand/mascot";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ThemedStatus, useStatusPhrase } from "@/components/brand/themed-status";
import { Markdown } from "@/components/markdown";
import { ProductStrip } from "@/components/product-card";
import { Spinner } from "@/components/ui";
import type { BazaarStore } from "@/lib/use-bazaar";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { cn, formatTokens, truncate } from "@/lib/ui";

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function ChatMessage({
  message,
  store,
  onOpenResults,
  onOpenSettings,
  isLast,
}: {
  message: ChatMessageType;
  store: BazaarStore;
  onOpenResults: () => void;
  onOpenSettings: () => void;
  isLast: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[86%] sm:max-w-[78%]">
          <div className="rounded-[18px] rounded-br-md bg-ink px-4 py-3 text-[14px] leading-relaxed text-paper">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  const activities = message.activities || [];
  const products = message.products || [];
  const notices = message.notices || [];
  const hasContent = Boolean(message.content.trim());
  const startPhrase = useStatusPhrase({
    messageId: message.id,
    startedAt: message.createdAt,
    activities,
    hasText: hasContent,
    active: streaming && !activities.length,
  });
  const showFallbackAction =
    message.status === "error" &&
    store.modelRegistry?.paidFallbackAvailable &&
    (message.errorCode === "404" ||
      message.errorCode === "429" ||
      message.errorCode === "500" ||
      message.errorCode === "502" ||
      message.errorCode === "503" ||
      message.errorCode === "504") &&
    !message.isFallback;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const metaParts = [
    message.modelLabel ? truncate(message.modelLabel, 38) : null,
    message.usage?.totalTokens ? formatTokens(message.usage.totalTokens) : null,
    timeLabel(message.createdAt),
  ].filter(Boolean);

  return (
    <div className="animate-fade-up">
      <div className="mb-2 flex items-center gap-2">
        <MascotBadge size={28} animated={streaming} />
        <span className="text-[13px] font-semibold text-ink">Bazaar</span>
        {message.isFallback ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            modello di riserva
          </span>
        ) : null}
      </div>

      <div className="sm:pl-8">
        <ActivityTimeline
          activities={activities}
          streaming={streaming}
          messageId={message.id}
          startedAt={message.createdAt}
          hasText={hasContent}
        />

        {notices.length ? (
          <div className="mb-4 space-y-1">
            {notices.map((notice) => (
              <p key={notice} className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                {notice}
              </p>
            ))}
          </div>
        ) : null}

        {hasContent ? (
          <Markdown streaming={streaming}>{message.content}</Markdown>
        ) : streaming && !activities.length ? (
          <ThemedStatus phrase={startPhrase} />
        ) : null}

        {products.length ? (
          <ProductStrip products={products} onOpenResults={onOpenResults} />
        ) : null}

        {message.status === "error" ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2.5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-rose-900">La ricerca si è fermata</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-rose-800">
                  {message.error || "Errore inatteso."}
                </p>
                {/data policy|privacy|zdr/i.test(message.error || "") ? (
                  <a
                    href="https://openrouter.ai/settings/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-10 items-center gap-1 text-[12px] font-medium text-rose-800 underline decoration-rose-300 underline-offset-2 hover:decoration-rose-500"
                  >
                    Apri le impostazioni privacy di OpenRouter
                  </a>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {showFallbackAction ? (
                    <button
                      type="button"
                      onClick={() => void store.retryWithPaidFallback()}
                      disabled={store.isStreaming}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      Riprova con il modello a pagamento
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void store.retryLast()}
                    disabled={store.isStreaming}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2 text-[13px] font-medium text-rose-800 transition hover:border-rose-400 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {showFallbackAction ? "Riprova gratis" : "Riprova"}
                  </button>
                  {message.error?.toLowerCase().includes("marketplace") ? (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2 text-[13px] font-medium text-rose-800 transition hover:border-rose-400"
                    >
                      <WifiOff className="h-4 w-4" />
                      Controlla le connessioni
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {message.status === "stopped" ? (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <Square className="h-4 w-4" />
            Ricerca interrotta.
            <button
              type="button"
              onClick={() => void store.retryLast()}
              disabled={store.isStreaming}
              className="inline-flex min-h-10 items-center font-medium text-accent underline decoration-accent/30 underline-offset-2"
            >
              Riprova
            </button>
          </div>
        ) : null}

        {!streaming && hasContent ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
            <span className="min-w-0 truncate font-mono text-[11px]">{metaParts.join(" · ")}</span>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-10 items-center gap-1 transition hover:text-ink"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiato" : "Copia"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

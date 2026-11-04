"use client";

import { ArrowUpRight, WifiOff } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { MARKETPLACE_IDS } from "@/lib/marketplaces";
import { useT } from "@/lib/i18n/client";
import type { BazaarStore } from "@/lib/use-bazaar";

const SUGGESTION_KEYS = [
  ["welcome.s1.label", "welcome.s1.query"],
  ["welcome.s2.label", "welcome.s2.query"],
  ["welcome.s3.label", "welcome.s3.query"],
  ["welcome.s4.label", "welcome.s4.query"],
] as const;

export function Welcome({
  store,
  onOpenSettings,
}: {
  store: BazaarStore;
  onOpenSettings: () => void;
}) {
  const { t } = useT();
  const total = store.status?.mcp.length || MARKETPLACE_IDS.length;
  const offline = store.status?.mcp.filter((server) => server.status === "offline").length || 0;

  return (
    <div className="welcome">
      <div className="mb-6 flex items-end gap-4 sm:gap-5">
        <Mascot mood="sniff" size={132} animated className="h-auto w-[104px] sm:w-[132px]" />
        <p className="pb-2 font-serif text-[20px] italic leading-[1.15] tracking-[-0.01em] text-ink-2 sm:text-[24px]">
          {t("brand.tagline1")}
          <br />
          {t("brand.tagline2")}
        </p>
      </div>
      <h1 className="welcome-title">
        {t("welcome.title1")}
        <br />
        <span className="welcome-title-accent">{t("welcome.title2")}</span>
      </h1>
      <p className="welcome-sub">
        {t("welcome.sub", { count: total })}
      </p>

      {offline ? (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-4 inline-flex min-h-10 items-center gap-2 text-[13px] text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
        >
          <WifiOff className="h-4 w-4 text-accent" />
          {t("welcome.offline", { offline, total })}
        </button>
      ) : null}

      <div className="mt-8 border-t border-line">
        <p className="meta pb-1 pt-4 uppercase">{t("welcome.try")}</p>
        {SUGGESTION_KEYS.map(([labelKey, queryKey]) => (
          <button
            key={queryKey}
            type="button"
            onClick={() => void store.sendMessage(t(queryKey))}
            disabled={store.isStreaming}
            className="suggestion group text-left disabled:opacity-50"
          >
            <span className="meta hidden w-[72px] shrink-0 uppercase sm:block">{t(labelKey)}</span>
            <span className="min-w-0 flex-1 text-[14px] leading-[1.4] text-ink">
              {t(queryKey)}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-accent" />
          </button>
        ))}
      </div>
    </div>
  );
}

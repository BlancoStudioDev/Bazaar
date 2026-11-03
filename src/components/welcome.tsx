"use client";

import { ArrowUpRight, WifiOff } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { MARKETPLACE_IDS } from "@/lib/marketplaces";
import type { BazaarStore } from "@/lib/use-bazaar";

const SUGGESTIONS = [
  {
    label: "Moda",
    query: "Voglio una borsa Longchamp Le Pliage. Dimmi qual è la più economica e dove comprarla.",
  },
  {
    label: "Hardware",
    query: "Cerco una RTX 4070 usata a Milano. Confronta i prezzi e dimmi dove conviene.",
  },
  {
    label: "Audio",
    query: "Cuffie noise cancelling sotto 100 €: quali sono le migliori offerte online?",
  },
  {
    label: "Tech",
    query: "iPhone 15 128 GB, anche usato. Trova il prezzo più basso e i link.",
  },
];

export function Welcome({
  store,
  onOpenSettings,
}: {
  store: BazaarStore;
  onOpenSettings: () => void;
}) {
  const total = store.status?.mcp.length || MARKETPLACE_IDS.length;
  const offline = store.status?.mcp.filter((server) => server.status === "offline").length || 0;

  return (
    <div className="welcome">
      <div className="mb-6 flex items-end gap-4 sm:gap-5">
        <Mascot mood="sniff" size={132} animated className="h-auto w-[104px] sm:w-[132px]" />
        <p className="pb-2 font-serif text-[20px] italic leading-[1.15] tracking-[-0.01em] text-ink-2 sm:text-[24px]">
          Il fiuto giusto
          <br />
          per ogni affare.
        </p>
      </div>
      <h1 className="welcome-title">
        Dimmi cosa cerchi.
        <br />
        <span className="welcome-title-accent">Ti dico dove costa meno.</span>
      </h1>
      <p className="welcome-sub">
        Confronto prezzi e condizioni su {total} marketplace e ti indico il link giusto.
      </p>

      {offline ? (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-4 inline-flex min-h-10 items-center gap-2 text-[13px] text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
        >
          <WifiOff className="h-4 w-4 text-accent" />
          {offline} su {total} marketplace non risponde. Controlla le connessioni
        </button>
      ) : null}

      <div className="mt-8 border-t border-line">
        <p className="meta pb-1 pt-4 uppercase">Prova con</p>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.query}
            type="button"
            onClick={() => void store.sendMessage(suggestion.query)}
            disabled={store.isStreaming}
            className="suggestion group text-left disabled:opacity-50"
          >
            <span className="meta hidden w-[72px] shrink-0 uppercase sm:block">{suggestion.label}</span>
            <span className="min-w-0 flex-1 text-[14px] leading-[1.4] text-ink">
              {suggestion.query}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-accent" />
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { seedFrom, statusPhrase } from "@/lib/brand/phrases";
import type { ToolActivity } from "@/lib/types";

/** Millisecondi trascorsi da `since` mentre `active`; aggiorna ogni secondo. */
export function useElapsed(since: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return Math.max(0, now - since);
}

/** Frase di attesa nella voce di Fiuto, coerente con ciò che sta succedendo davvero. */
export function useStatusPhrase(options: {
  messageId: string;
  startedAt: number;
  activities: ToolActivity[];
  hasText: boolean;
  active: boolean;
}): string {
  const elapsedMs = useElapsed(options.startedAt, options.active);
  return statusPhrase({
    activities: options.activities,
    hasText: options.hasText,
    elapsedMs,
    seed: seedFrom(options.messageId),
  });
}

/** Riga di attesa quando non c'è ancora nessuna ricerca in corso (la timeline mostra il resto). */
export function ThemedStatus({ phrase }: { phrase: string }) {
  return (
    <p className="flex items-center gap-2 py-2 text-[13px] text-muted" role="status" aria-live="polite">
      <span key={phrase} className="fx-phrase">
        {phrase}
      </span>
    </p>
  );
}

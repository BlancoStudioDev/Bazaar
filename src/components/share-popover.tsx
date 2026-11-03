"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link2Off, Share2 } from "lucide-react";

import { Spinner } from "@/components/ui";
import type { BazaarStore } from "@/lib/use-bazaar";

type Phase = "idle" | "creating" | "ready" | "error" | "confirm-stop" | "stopping";

/** Pulsante «Condividi» con popover: crea il link pubblico, lo copia, permette di revocarlo. */
export function SharePopover({ store }: { store: BazaarStore }) {
  const conversation = store.activeConversation;
  const existingUrl = conversation?.shareUrl && conversation.shareToken ? conversation.shareUrl : null;

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const url = existingUrl;

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
      setTimeout(() => setCopied((current) => (current === "yes" ? null : current)), 2000);
    } catch {
      // Appunti non disponibili (contesto non sicuro o permesso negato): selezione manuale.
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopied("manual");
    }
  }, []);

  const create = useCallback(async () => {
    setPhase("creating");
    setError(null);
    const result = await store.shareConversation();
    if (!result.ok) {
      setError(result.error);
      setPhase("error");
      return;
    }
    setPhase("ready");
    void copy(result.url);
  }, [store, copy]);

  const onToggle = () => {
    if (open) return close();
    setOpen(true);
    setCopied(null);
    setError(null);
    if (url) setPhase("ready");
    else void create();
  };

  const stop = async () => {
    setPhase("stopping");
    const result = await store.unshareConversation();
    if (!result.ok) {
      setError(result.error);
      setPhase("ready");
      return;
    }
    setOpen(false);
    setPhase("idle");
    triggerRef.current?.focus();
  };

  // Cambiando chat il popover si chiude.
  useEffect(() => {
    if (activeIdRef.current !== null && activeIdRef.current !== store.activeId) setOpen(false);
    activeIdRef.current = store.activeId;
  }, [store.activeId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const shareable = Boolean(
    conversation?.messages.some((message) => message.role === "assistant" && message.content.trim()),
  );
  if (!shareable) return null;

  const busy = phase === "creating" || phase === "stopping";
  const shared = Boolean(url);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        disabled={store.isStreaming}
        className="icon-btn relative disabled:opacity-50"
        aria-label={shared ? "Condividi, chat già condivisa" : "Condividi"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={store.isStreaming ? "Attendi la fine della ricerca per condividere" : "Condividi"}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        {shared ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" aria-hidden /> : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Condividi la chat"
          className="fixed inset-x-4 top-[72px] z-50 rounded-2xl border border-line bg-paper p-4 shadow-[0_18px_48px_rgba(23,21,18,0.18)] animate-fade-up sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[372px]"
        >
          <h2 className="font-serif text-[24px] leading-none tracking-[-0.02em] text-ink">Condividi la chat</h2>

          {phase === "creating" || (phase === "idle" && !url) ? (
            <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-2" role="status">
              <Spinner className="h-4 w-4 text-accent" />
              Sto creando il link…
            </p>
          ) : null}

          {phase === "error" ? (
            <div className="mt-3">
              <p className="text-[13px] leading-relaxed text-rose-800" role="alert">
                {error || "Non sono riuscito a creare il link. Riprova."}
              </p>
              <button type="button" onClick={() => void create()} className="btn-quiet mt-3">
                Riprova
              </button>
            </div>
          ) : null}

          {url && phase !== "creating" && phase !== "error" ? (
            <div className="mt-3">
              <p className="text-[13px] leading-relaxed text-ink-2">
                Chiunque abbia il link può leggere questa chat, senza accedere. Mostra la chat com&apos;era al momento
                della condivisione.
              </p>
              <label htmlFor="share-url" className="meta mt-4 block uppercase">
                Link pubblico
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="share-url"
                  ref={inputRef}
                  readOnly
                  value={url}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 font-mono text-[12px] text-ink"
                />
                <button type="button" onClick={() => void copy(url)} className="btn-quiet shrink-0">
                  {copied === "yes" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied === "yes" ? "Copiato" : "Copia"}
                </button>
              </div>
              <p className="mt-2 min-h-[18px] text-[12px] text-muted" role="status">
                {copied === "yes"
                  ? "Link copiato negli appunti."
                  : copied === "manual"
                    ? "Non posso usare gli appunti: seleziona il link e copialo a mano."
                    : ""}
              </p>
              {error ? (
                <p className="mt-1 text-[13px] text-rose-800" role="alert">
                  {error}
                </p>
              ) : null}

              {phase === "confirm-stop" ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-[13px] leading-relaxed text-rose-900">
                    Il link smetterà di funzionare per tutti. Potrai crearne uno nuovo quando vuoi.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void stop()}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-ink/85"
                    >
                      <Link2Off className="h-4 w-4" aria-hidden />
                      Smetti di condividere
                    </button>
                    <button type="button" onClick={() => setPhase("ready")} className="btn-quiet">
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase("confirm-stop");
                  }}
                  disabled={busy}
                  className="mt-1 inline-flex min-h-10 items-center gap-2 text-[13px] font-medium text-ink-2 underline decoration-line underline-offset-4 transition hover:text-ink disabled:opacity-50"
                >
                  {phase === "stopping" ? <Spinner className="h-4 w-4" /> : <Link2Off className="h-4 w-4" aria-hidden />}
                  Smetti di condividere
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

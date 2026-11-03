"use client";

import { useEffect, useMemo, useState } from "react";
import { Menu, PanelRight, Plus, Settings2 } from "lucide-react";

import { ChatView } from "@/components/chat-view";
import { ConnectionsDialog } from "@/components/connections-dialog";
import { ModelDialog } from "@/components/model-dialog";
import { ResultsBoard } from "@/components/results-board";
import { Sidebar } from "@/components/sidebar";
import { Spinner } from "@/components/ui";
import type { BazaarStore } from "@/lib/use-bazaar";
import { cn } from "@/lib/ui";

function countProducts(store: BazaarStore): number {
  const messages = store.activeConversation?.messages || [];
  const set = new Set<string>();
  for (const message of messages) {
    for (const product of message.products || []) {
      set.add(product.url || product.key);
    }
  }
  return set.size;
}

export function AppShell({ store }: { store: BazaarStore }) {
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [desktopSidebar, setDesktopSidebar] = useState(true);
  const [mobileResults, setMobileResults] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const productCount = useMemo(() => countProducts(store), [store.activeConversation]);
  const offline = store.status?.mcp.filter((server) => server.status !== "online").length || 0;
  const title = store.activeConversation?.title || "Nuova ricerca";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileSidebar(false);
        setMobileResults(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        store.newConversation();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  const isWide = () => window.matchMedia("(min-width: 1280px)").matches;

  const openResults = () => {
    if (isWide()) setResultsVisible(true);
    else setMobileResults(true);
  };

  const toggleResults = () => {
    if (isWide()) setResultsVisible((value) => !value);
    else setMobileResults(true);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <div className={cn("hidden", desktopSidebar && "lg:flex")}>
        <Sidebar
          store={store}
          onNew={() => {
            store.newConversation();
            setMobileSidebar(false);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {mobileSidebar ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            aria-label="Chiudi menu"
            onClick={() => setMobileSidebar(false)}
          />
          <div className="relative z-10 h-full w-[302px] max-w-[88vw] animate-slide-right">
            <Sidebar
              store={store}
              mobile
              onNew={() => {
                store.newConversation();
                setMobileSidebar(false);
              }}
              onSelect={() => setMobileSidebar(false)}
              onOpenSettings={() => {
                setMobileSidebar(false);
                setSettingsOpen(true);
              }}
              onClose={() => setMobileSidebar(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileSidebar(true)}
            className="icon-btn lg:hidden"
            aria-label="Apri la cronologia"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDesktopSidebar((value) => !value)}
            className="icon-btn hidden lg:inline-flex"
            aria-label={desktopSidebar ? "Nascondi la cronologia" : "Mostra la cronologia"}
            aria-expanded={desktopSidebar}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-semibold text-ink">{title}</h1>
            {store.isStreaming ? (
              <p className="flex items-center gap-1 text-[12px] text-muted">
                <Spinner className="h-3 w-3 shrink-0 text-accent" />
                <span className="truncate">Ricerca in corso…</span>
              </p>
            ) : null}
          </div>

          {productCount ? (
            <button
              type="button"
              onClick={toggleResults}
              className="btn-quiet"
              aria-label={`Bacheca, ${productCount} prodotti`}
            >
              <PanelRight className="h-4 w-4" />
              <span className="hidden sm:inline">Bacheca</span>
              <span className="font-mono text-[12px] text-muted">{productCount}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="icon-btn relative"
            aria-label={
              offline ? `Impostazioni, ${offline} marketplace offline` : "Impostazioni"
            }
          >
            <Settings2 className="h-4 w-4" />
            {offline ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" aria-hidden />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              store.newConversation();
              setMobileSidebar(false);
            }}
            className="icon-btn border-ink bg-ink text-paper hover:text-paper lg:hidden"
            aria-label="Nuova ricerca"
          >
            <Plus className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <ChatView
            store={store}
            onOpenResults={openResults}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <div
            className={cn(
              "results-col hidden xl:flex",
              !resultsVisible && "xl:hidden",
            )}
          >
            <ResultsBoard store={store} onClose={() => setResultsVisible(false)} />
          </div>
        </div>
      </div>

      {mobileResults ? (
        <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            aria-label="Chiudi bacheca"
            onClick={() => setMobileResults(false)}
          />
          <div className="relative z-10 h-full w-[92vw] max-w-[400px] animate-slide-left">
            <ResultsBoard store={store} mobile onClose={() => setMobileResults(false)} />
          </div>
        </div>
      ) : null}

      <ConnectionsDialog
        store={store}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenModel={() => {
          setSettingsOpen(false);
          setModelOpen(true);
        }}
      />
      <ModelDialog
        store={store}
        open={modelOpen}
        onClose={() => setModelOpen(false)}
        onBack={() => {
          setModelOpen(false);
          setSettingsOpen(true);
        }}
      />
    </div>
  );
}

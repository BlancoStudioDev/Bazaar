"use client";

import { LogOut, Plus, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import type { ClientUser } from "@/components/home-client";
import { authClient } from "@/lib/auth/client";

import { MARKETPLACE_IDS } from "@/lib/marketplaces";
import { withBasePath } from "@/lib/base-path";
import type { BazaarStore } from "@/lib/use-bazaar";
import { useT } from "@/lib/i18n/client";
import { cn, groupConversations, relativeTime } from "@/lib/ui";

export function Sidebar({
  store,
  user,
  onNew,
  onOpenSettings,
  onClose,
  onSelect,
  mobile = false,
}: {
  store: BazaarStore;
  user?: ClientUser;
  onNew: () => void;
  onOpenSettings: () => void;
  onClose?: () => void;
  onSelect?: () => void;
  mobile?: boolean;
}) {
  const { t, lang } = useT();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign(withBasePath("/login"));
    }
  };
  const groups = groupConversations(store.conversations, lang);
  const online = store.status?.mcp.filter((server) => server.status === "online").length ?? 0;
  const total = store.status?.mcp.length || MARKETPLACE_IDS.length;
  const allOnline = Boolean(store.status) && online === total;

  return (
    <aside className={cn("sidebar", mobile && "is-mobile")}>
      <div className="flex items-center justify-between gap-4 px-4 pb-4 pt-6">
        <Logo tone="light" size={32} />
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sidebar-ink/70 transition hover:bg-white/10 hover:text-sidebar-ink"
            aria-label={t("app.closeMenu")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="px-4">
        <button type="button" onClick={onNew} className="new-search-button">
          <Plus className="h-4 w-4" />
          <span className="flex-1 text-left text-[13px] font-medium">{t("app.newSearch")}</span>
          <span className="hidden font-mono text-[11px] text-ink/40 lg:inline">⌘N</span>
        </button>
      </div>

      <nav aria-label={t("sidebar.history")} className="scrollbar-dark mt-4 flex-1 overflow-y-auto px-2">
        {groups.length ? (
          groups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-sidebar-ink/45">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((conversation) => {
                  const active = conversation.id === store.activeId;
                  return (
                    <li
                      key={conversation.id}
                      className={cn(
                        "group/item relative flex items-center rounded-xl transition",
                        active
                          ? "bg-sidebar-ink/[0.1] text-sidebar-ink"
                          : "text-sidebar-ink/70 hover:bg-white/[0.05] hover:text-sidebar-ink",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          store.selectConversation(conversation.id);
                          onSelect?.();
                        }}
                        aria-current={active ? "true" : undefined}
                        className="min-h-10 min-w-0 flex-1 px-3 py-2 text-left"
                      >
                        <span className="block truncate text-[13px] leading-tight">
                          {conversation.title}
                        </span>
                        <span className="mt-1 block font-mono text-[11px] text-sidebar-ink/45">
                          {relativeTime(conversation.updatedAt, lang)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t("sidebar.deleteConfirm", { title: conversation.title }))) {
                            store.deleteConversation(conversation.id);
                          }
                        }}
                        className={cn(
                          "mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sidebar-ink/50 transition hover:bg-white/10 hover:text-sidebar-ink focus-visible:opacity-100",
                          mobile ? "" : "opacity-0 group-hover/item:opacity-100",
                        )}
                        aria-label={t("sidebar.delete", { title: conversation.title })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <p className="px-3 py-4 text-[13px] leading-relaxed text-sidebar-ink/55">
            {t("sidebar.empty")}
          </p>
        )}
      </nav>

      <div className="border-t border-white/[0.08] p-2">
        <button type="button" onClick={onOpenSettings} className="sidebar-card">
          <Settings2 className="h-4 w-4 shrink-0 text-sidebar-ink/70" />
          <span className="min-w-0 flex-1 text-[13px] text-sidebar-ink">{t("app.settings")}</span>
          <span
            className={cn(
              "inline-flex items-center gap-2 font-mono text-[11px]",
              allOnline ? "text-sidebar-ink/55" : "text-accent",
            )}
          >
            <span
              className={cn("h-2 w-2 rounded-full", allOnline ? "bg-emerald-400" : "bg-accent")}
              aria-hidden
            />
            {store.status ? `${online}/${total}` : "…"}
          </span>
        </button>
        {user?.authEnabled ? (
          <div className="mt-1 flex items-center gap-2 px-3 py-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-sidebar-ink">{user.name}</p>
              {user.email && user.email !== user.name ? (
                <p className="truncate font-mono text-[11px] text-sidebar-ink/45">{user.email}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] text-sidebar-ink/60 transition hover:bg-white/10 hover:text-sidebar-ink disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t("sidebar.signOut")}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

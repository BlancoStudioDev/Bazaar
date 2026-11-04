"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw, TriangleAlert } from "lucide-react";

import { MARKETPLACES, MARKETPLACE_IDS } from "@/lib/marketplaces";
import { Modal, Spinner } from "@/components/ui";
import type { BazaarStore } from "@/lib/use-bazaar";
import type { McpServerInfo } from "@/lib/types";
import { LANGS, LANG_NATIVE_NAMES, isLangSetting } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn, formatDuration, modelShortName, timeLabel } from "@/lib/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 className="meta mb-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function ServerRow({
  server,
  onReconnect,
  loading,
}: {
  server: McpServerInfo;
  onReconnect: () => void;
  loading: boolean;
}) {
  const { t, lang } = useT();
  const meta = MARKETPLACES[server.id];
  return (
    <li className="py-2">
      <div className="flex min-h-10 items-center gap-3">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", server.status !== "online" && "opacity-40")}
          style={{ backgroundColor: meta?.color || "#888" }}
          aria-hidden
        />
        <p className="min-w-0 flex-1 truncate text-[13px] text-ink">{server.label}</p>
        <span
          className={cn(
            "text-[12px]",
            server.status === "online" ? "text-muted" : "font-medium text-accent",
          )}
        >
          {t(`status.${server.status}`)}
        </span>
        <button
          type="button"
          onClick={onReconnect}
          disabled={loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-paper-2 hover:text-ink disabled:opacity-50"
          aria-label={t("settings.reconnectOne", { label: server.label })}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      {server.error ? (
        <p className="ml-5 rounded-lg bg-paper-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2">
          {server.error}
        </p>
      ) : null}
      {server.latencyMs || server.tools.length ? (
        <p className="ml-5 mt-1 text-[12px] text-muted">
          {t("settings.tools", { count: server.tools.length })}
          {server.latencyMs ? ` · ${formatDuration(server.latencyMs, lang)}` : ""}
        </p>
      ) : null}
    </li>
  );
}

export function ConnectionsDialog({
  store,
  open,
  onClose,
  onOpenModel,
}: {
  store: BazaarStore;
  open: boolean;
  onClose: () => void;
  onOpenModel: () => void;
}) {
  const { t, lang } = useT();
  const [reconnectingAll, setReconnectingAll] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const status = store.status;
  const openrouter = status?.openrouter;
  const servers = status?.mcp || [];
  const online = servers.filter((server) => server.status === "online").length;
  const selectedModel =
    store.settings.modelMode === "manual" && store.settings.modelId
      ? store.modelRegistry?.models.find((model) => model.id === store.settings.modelId)
      : store.modelRegistry?.selected;
  const paidAvailable = Boolean(store.modelRegistry?.paidFallbackAvailable);
  const enabled = store.settings.enabledMarketplaces;
  const statusById = new Map(servers.map((server) => [server.id, server.status]));

  useEffect(() => {
    if (open) void store.refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reconnectAll = async () => {
    setReconnectingAll(true);
    try {
      await store.reconnect();
    } finally {
      setReconnectingAll(false);
    }
  };

  const busy = store.statusLoading || reconnectingAll;

  return (
    <Modal open={open} onClose={onClose} title={t("settings.title")} width="max-w-[560px]">
      <Section title={t("settings.where")}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.marketplacesAria")}>
          {MARKETPLACE_IDS.map((id) => {
            const meta = MARKETPLACES[id];
            const active = enabled.includes(id);
            const offline = statusById.get(id) === "offline";
            return (
              <button
                key={id}
                type="button"
                onClick={() => store.toggleMarketplace(id)}
                aria-pressed={active}
                title={offline ? t("settings.offlineTitle", { label: meta.label }) : meta.description}
                className={cn("filter-chip", active && "is-active", offline && "opacity-60")}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                {meta.shortLabel}
              </button>
            );
          })}
        </div>
        {enabled.includes("facebook-marketplace") || enabled.includes("subito") || enabled.includes("wallapop") ? (
          <label className="mt-3 flex items-center justify-between gap-4">
            <span className="text-[13px] text-ink">{t("settings.city")}</span>
            <input
              value={store.settings.city}
              onChange={(event) => store.updateSettings({ city: event.target.value })}
              onBlur={() => {
                store.updateSettings({ city: store.settings.city.trim() || "Milano" });
              }}
              className="h-10 w-[140px] rounded-full border border-line bg-card px-4 text-[13px] text-ink outline-none transition focus:border-ink/50"
              placeholder="Milano"
            />
          </label>
        ) : null}
      </Section>

      <Section title={t("settings.language")}>
        <label className="flex items-center justify-between gap-4">
          <span className="sr-only">{t("settings.language")}</span>
          <select
            value={store.settings.lang}
            onChange={(event) => {
              if (isLangSetting(event.target.value)) store.updateSettings({ lang: event.target.value });
            }}
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-[13px] text-ink outline-none transition focus:border-ink/50"
          >
            <option value="auto">{t("settings.languageAuto")}</option>
            {LANGS.map((code) => (
              <option key={code} value={code}>
                {LANG_NATIVE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title={t("settings.model")}>
        <div className="flex min-h-10 items-center justify-between gap-4">
          <p className="min-w-0 text-[13px] text-ink">
            <span className="block truncate">
              {selectedModel ? modelShortName(selectedModel.name) : t("settings.modelLoading")}
            </span>
            <span className="text-[12px] text-muted">
              {store.settings.modelMode === "auto" ? t("settings.modelAuto") : t("settings.modelManual")}
            </span>
          </p>
          <button type="button" onClick={onOpenModel} className="btn-quiet shrink-0">
            {t("settings.change")}
          </button>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] text-ink">{t("settings.paid")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {paidAvailable
                ? t("settings.paidOn")
                : t("settings.paidOff")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={store.settings.allowPaidFallback}
            aria-label={t("settings.paid")}
            disabled={!paidAvailable}
            onClick={() =>
              store.updateSettings({ allowPaidFallback: !store.settings.allowPaidFallback })
            }
            className="group flex h-10 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span
              className={cn(
                "relative h-6 w-10 rounded-full border transition",
                store.settings.allowPaidFallback ? "border-accent bg-accent" : "border-line bg-paper-2",
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition",
                  store.settings.allowPaidFallback ? "left-[21px]" : "left-[3px]",
                )}
              />
            </span>
          </button>
        </div>
      </Section>

      <Section title={t("settings.connections")}>
        {store.statusError ? (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {store.statusError}
          </p>
        ) : null}
        <div className="flex min-h-10 items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-[13px] text-ink">
            {store.statusLoading && !status ? <Spinner className="h-4 w-4 text-accent" /> : null}
            {servers.length
              ? online === servers.length
                ? t("settings.allUp", { total: servers.length })
                : t("settings.someUp", { online, total: servers.length })
              : t("common.checking")}
          </p>
          <button
            type="button"
            onClick={() => void reconnectAll()}
            disabled={busy}
            className="btn-quiet shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            {t("settings.reconnect")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          aria-expanded={detailsOpen}
          className="-ml-2 mt-1 inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-[12px] text-muted transition hover:text-ink"
        >
          {t("settings.details")}
          <ChevronDown className={cn("h-4 w-4 transition", detailsOpen && "rotate-180")} />
        </button>
        {detailsOpen ? (
          <div>
            <ul className="divide-y divide-line/70">
              {servers.map((server) => (
                <ServerRow
                  key={server.id}
                  server={server}
                  loading={busy}
                  onReconnect={() => void store.reconnect(server.id)}
                />
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              OpenRouter: {openrouter?.ok ? t("settings.orConnected") : openrouter?.error || t("settings.orError")}
              {openrouter?.freeLimit
                ? ` · ${t("settings.orFree", { used: openrouter.freeUsed ?? 0, limit: openrouter.freeLimit })}`
                : ""}
              {openrouter?.credits != null
                ? ` · ${t("settings.orCredits", { amount: openrouter.credits.toFixed(2) })}`
                : ""}
              {status ? ` · ${t("settings.orChecked", { time: timeLabel(status.checkedAt, lang) })}` : ""}
            </p>
          </div>
        ) : null}
      </Section>

      <Section title={t("settings.history")}>
        <div className="flex min-h-10 items-center justify-between gap-4">
          <p className="text-[13px] text-muted">{t("settings.historyNote")}</p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t("settings.clearConfirm"))) {
                store.clearAllConversations();
                onClose();
              }
            }}
            className="btn-quiet shrink-0 border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-800"
          >
            {t("settings.clearAll")}
          </button>
        </div>
      </Section>
    </Modal>
  );
}

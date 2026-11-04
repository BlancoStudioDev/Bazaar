"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, RefreshCw, TriangleAlert } from "lucide-react";

import { Modal, ScoreBar, Spinner } from "@/components/ui";
import type { BazaarStore } from "@/lib/use-bazaar";
import type { FreeModel } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import { cn, formatTokens, modelShortName } from "@/lib/ui";

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-ink bg-ink text-paper" : "border-line bg-card",
      )}
      aria-hidden
    >
      {selected ? <Check className="h-3 w-3" /> : null}
    </span>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
}: {
  model: FreeModel;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, lang } = useT();
  const [details, setDetails] = useState(false);
  return (
    <li className={cn("rounded-xl border", selected ? "border-ink" : "border-line")}>
      <div className="flex items-start">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex min-h-12 min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left"
        >
          <Radio selected={selected} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">
              {modelShortName(model.name)}
            </span>
            <span className="block truncate text-[12px] text-muted">
              {model.provider} · {model.isRouter ? t("model.freeRouter") : t("model.free")}
            </span>
            {model.isRouter ? (
              <span className="block text-[12px] text-muted">
                {t("model.routerDesc")}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDetails((value) => !value)}
          aria-expanded={details}
          aria-label={t("model.detailsOf", { name: modelShortName(model.name) })}
          className="flex h-12 items-center gap-1 px-3 text-[12px] text-muted transition hover:text-ink"
        >
          {t("model.details")}
          <ChevronDown className={cn("h-4 w-4 transition", details && "rotate-180")} />
        </button>
      </div>
      {details ? (
        <div className="border-t border-line px-4 py-3">
          <div className="grid grid-cols-3 gap-4">
            <ScoreBar label={t("model.intelligence")} value={model.scores.intelligence} compact />
            <ScoreBar label={t("model.speed")} value={model.scores.speed} compact />
            <ScoreBar label={t("model.reliability")} value={model.scores.reliability} compact />
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {t("model.context", { tokens: formatTokens(model.contextLength, lang) })}
            {model.metrics.latencyMs
              ? ` · ${t("model.latency", { seconds: (model.metrics.latencyMs / 1000).toFixed(1) })}`
              : ""}
            {model.metrics.throughput ? ` · ${Math.round(model.metrics.throughput)} token/s` : ""}
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function ModelDialog({
  store,
  open,
  onClose,
  onBack,
}: {
  store: BazaarStore;
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}) {
  const { t } = useT();
  const registry = store.modelRegistry;
  const autoSelected = store.settings.modelMode === "auto";
  const selected = useMemo(() => {
    if (!registry) return null;
    if (autoSelected) return registry.selected;
    if (registry.routerModel && store.settings.modelId === registry.routerModel.id) {
      return registry.routerModel;
    }
    return registry.models.find((model) => model.id === store.settings.modelId) || registry.selected;
  }, [autoSelected, registry, store.settings.modelId]);

  const choose = (patch: { modelMode: "auto" | "manual"; modelId: string | null }) => {
    store.updateSettings(patch);
  };

  return (
    <Modal open={open} onClose={onClose} title={t("model.title")} width="max-w-[560px]">
      {!registry ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted">
          <Spinner className="h-4 w-4 text-accent" />
          {t("model.loading")}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-[13px] text-muted">
              {t("model.inUse")}{" "}
              <span className="text-ink">{selected ? modelShortName(selected.name) : t("model.none")}</span>
            </p>
            <button
              type="button"
              onClick={() => void store.refreshModels(true)}
              disabled={store.modelsLoading}
              className="btn-quiet shrink-0"
            >
              <RefreshCw className={cn("h-4 w-4", store.modelsLoading && "animate-spin")} />
              {t("model.refresh")}
            </button>
          </div>

          {store.modelsError ? (
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {t("model.errorFallback", { error: store.modelsError })}
            </p>
          ) : null}

          <ul className="space-y-2">
            <li className={cn("rounded-xl border", autoSelected ? "border-ink" : "border-line")}>
              <button
                type="button"
                onClick={() => choose({ modelMode: "auto", modelId: null })}
                aria-pressed={autoSelected}
                className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left"
              >
                <Radio selected={autoSelected} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{t("model.auto")}</span>
                  <span className="block text-[12px] text-muted">
                    {t("model.autoDesc")}
                  </span>
                </span>
              </button>
            </li>
            {registry.models.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                selected={!autoSelected && selected?.id === model.id}
                onSelect={() => choose({ modelMode: "manual", modelId: model.id })}
              />
            ))}
            {registry.routerModel ? (
              <ModelRow
                model={registry.routerModel}
                selected={!autoSelected && selected?.id === registry.routerModel.id}
                onSelect={() =>
                  choose({ modelMode: "manual", modelId: registry.routerModel?.id || null })
                }
              />
            ) : null}
          </ul>

          {registry.cheapModels?.length ? (
            <section className="mt-5">
              <h3 className="text-[13px] font-medium text-ink">{t("model.paidTitle")}</h3>
              <p className="mt-1 text-[12px] text-muted">
                {t("model.paidDesc")}
              </p>
              <ul className="mt-2 space-y-1">
                {registry.cheapModels.map((model) => (
                  <li
                    key={model.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 text-[12px]"
                  >
                    <span className="min-w-0 truncate text-ink">{modelShortName(model.name)}</span>
                    <span className="shrink-0 text-muted">
                      {model.pricePerMillion != null
                        ? `~$${model.pricePerMillion.toFixed(model.pricePerMillion < 0.1 ? 3 : 2)} / 1M`
                        : t("model.priceNa")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {onBack ? (
            <button type="button" onClick={onBack} className="btn-quiet mt-4">
              {t("model.back")}
            </button>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

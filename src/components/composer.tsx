"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, SlidersHorizontal, Square } from "lucide-react";

import type { BazaarStore } from "@/lib/use-bazaar";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/ui";
import { Spinner } from "@/components/ui";

export function Composer({
  store,
  onOpenSettings,
}: {
  store: BazaarStore;
  onOpenSettings: () => void;
}) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [value]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || store.isStreaming) return;
    setValue("");
    void store.sendMessage(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const enabled = store.settings.enabledMarketplaces.length;
  const local = store.settings.enabledMarketplaces.some(
    (id) => id === "facebook-marketplace" || id === "subito",
  );
  const scope = local
    ? t("composer.scopeCity", { count: enabled, city: store.settings.city.trim() || "Milano" })
    : t("composer.scope", { count: enabled });

  return (
    <div className="composer-wrap">
      <div className={cn("composer", focused && "is-focused")}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          placeholder={t("composer.placeholder")}
          aria-label={t("composer.aria")}
          className="composer-input"
        />
        <div className="composer-footer">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-full px-3 text-[12px] text-muted transition hover:bg-paper-2 hover:text-ink"
            aria-label={t("composer.where", { scope })}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <span className="truncate">{scope}</span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {store.isStreaming ? (
              <button
                type="button"
                onClick={store.stop}
                className="composer-send is-stop"
                aria-label={t("composer.stop")}
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                className="composer-send"
                aria-label={t("composer.send")}
              >
                {store.modelsLoading && !store.modelRegistry ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

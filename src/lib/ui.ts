import type { Conversation, MarketplaceId } from "@/lib/types";
import { MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_LANG, LOCALES, t, type Lang } from "@/lib/i18n";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function truncate(value: string, length: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= length) return clean;
  return `${clean.slice(0, length - 1).trimEnd()}…`;
}

export function conversationTitle(text: string): string {
  return truncate(text, 46) || "…";
}

export function relativeTime(timestamp: number, lang: Lang = DEFAULT_LANG): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: "auto", style: "short" });
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return rtf.format(0, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "2-digit", month: "short" }).format(timestamp);
}

export function dayLabel(timestamp: number, lang: Lang = DEFAULT_LANG): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return t(lang, "time.today");
  if (sameDay(date, yesterday)) return t(lang, "time.yesterday");
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "2-digit", month: "long" }).format(date);
}

/** Ora del messaggio (HH:mm secondo la lingua). */
export function timeLabel(timestamp: number, lang: Lang = DEFAULT_LANG): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

export function formatDate(timestamp: number, lang: Lang = DEFAULT_LANG): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric" }).format(timestamp);
}

export function groupConversations(
  conversations: Conversation[],
  lang: Lang = DEFAULT_LANG,
): Array<{
  label: string;
  items: Conversation[];
}> {
  const groups = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const label = dayLabel(conversation.updatedAt, lang);
    const list = groups.get(label) || [];
    list.push(conversation);
    groups.set(label, list);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => b.updatedAt - a.updatedAt),
  }));
}

export function formatPrice(value: number | null | undefined, lang: Lang = DEFAULT_LANG): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(LOCALES[lang], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Prezzo da mostrare: formattato nella lingua se in euro, altrimenti l'etichetta originale ($/£ di eBay). */
export function displayPrice(
  product: { price: number | null; priceLabel: string | null },
  lang: Lang = DEFAULT_LANG,
): string {
  if (product.price === 0) return t(lang, "common.free");
  const foreign = product.priceLabel && /[$£]/.test(product.priceLabel);
  if (!foreign && product.price != null && product.price > 0) {
    return formatPrice(product.price, lang) || product.priceLabel || t(lang, "common.na");
  }
  return product.priceLabel || formatPrice(product.price, lang) || t(lang, "common.na");
}

/** Condizione tradotta (Usato/Nuovo/Ricondizionato dai server MCP); altri testi restano com'erano. */
export function conditionLabel(condition: string, lang: Lang = DEFAULT_LANG): string {
  const text = condition.trim();
  const key = /^(ricondizionat\w*|refurbished|renewed)\b/i.test(text)
    ? "cond.refurbished"
    : /^(usat\w*|used|seconda mano)\b/i.test(text)
      ? "cond.used"
      : /^(nuov\w*|new)\b/i.test(text)
        ? "cond.new"
        : null;
  if (!key) return text;
  const rest = text.replace(/^\S+(\s+mano)?/i, "");
  return `${t(lang, key)}${rest}`;
}

export function formatDuration(ms: number | undefined, lang: Lang = DEFAULT_LANG): string {
  if (ms == null) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  const seconds = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ms / 1000);
  return `${seconds} s`;
}

export function formatTokens(tokens: number | undefined, lang: Lang = DEFAULT_LANG): string {
  if (!tokens) return "";
  if (tokens < 1000) return `${tokens} token`;
  const k = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(tokens / 1000);
  return `${k}k token`;
}

export function marketplaceName(id: MarketplaceId | string): string {
  return MARKETPLACES[id as MarketplaceId]?.shortLabel || String(id);
}

export function marketplaceColor(id: MarketplaceId | string): string {
  return MARKETPLACES[id as MarketplaceId]?.color || "#8a8378";
}

export function modelShortName(name: string | undefined): string {
  if (!name) return "Model";
  return name
    .replace(/\s*\(free\)\s*/i, "")
    .replace(/^OpenRouter:\s*/i, "")
    .replace(/\s*·\s*(riserva|backup)/i, "")
    .trim();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreTone(score: number): "good" | "mid" | "low" {
  if (score >= 75) return "good";
  if (score >= 55) return "mid";
  return "low";
}

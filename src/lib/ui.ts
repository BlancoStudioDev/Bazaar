import type { Conversation, MarketplaceId } from "@/lib/types";
import { MARKETPLACES } from "@/lib/marketplaces";

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
  return truncate(text, 46) || "Nuova ricerca";
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ieri";
  if (days < 7) return `${days} g`;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(timestamp);
}

export function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Oggi";
  if (sameDay(date, yesterday)) return "Ieri";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long" }).format(date);
}

export function groupConversations(conversations: Conversation[]): Array<{
  label: string;
  items: Conversation[];
}> {
  const groups = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const label = dayLabel(conversation.updatedAt);
    const list = groups.get(label) || [];
    list.push(conversation);
    groups.set(label, list);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => b.updatedAt - a.updatedAt),
  }));
}

export function formatPrice(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDuration(ms: number | undefined): string {
  if (ms == null) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

export function formatTokens(tokens: number | undefined): string {
  if (!tokens) return "";
  if (tokens < 1000) return `${tokens} token`;
  return `${(tokens / 1000).toFixed(1).replace(".", ",")}k token`;
}

export function marketplaceName(id: MarketplaceId | string): string {
  return MARKETPLACES[id as MarketplaceId]?.shortLabel || String(id);
}

export function marketplaceColor(id: MarketplaceId | string): string {
  return MARKETPLACES[id as MarketplaceId]?.color || "#8a8378";
}

export function modelShortName(name: string | undefined): string {
  if (!name) return "Modello";
  return name
    .replace(/\s*\(free\)\s*/i, "")
    .replace(/^OpenRouter:\s*/i, "")
    .replace(/\s*·\s*riserva/i, "")
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

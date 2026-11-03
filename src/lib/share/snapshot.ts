/**
 * Snapshot pubblico di una chat condivisa. Puro (nessuna dipendenza da Node): lo usano
 * sia la route di creazione (validazione) sia la pagina pubblica (render).
 *
 * Contiene SOLO ciò che può diventare pubblico: ruolo + testo dei messaggi e i prodotti trovati
 * (campi essenziali). Mai argomenti dei tool, id/email dell'utente, `extra`, modello o token usati.
 */

import { MARKETPLACE_IDS, productHref } from "@/lib/marketplaces";
import type { MarketplaceId } from "@/lib/types";

export const SHARE_MAX_MESSAGES = 60;
export const SHARE_MAX_BYTES = 200 * 1024;
export const SHARE_MAX_PRODUCTS = 150;
const MAX_MESSAGE_CHARS = 40_000;
const MAX_URL = 2000;

/** 24 byte casuali in base64url = 32 caratteri (192 bit). */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function isValidShareToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export interface SharedProduct {
  title: string;
  price: number | null;
  priceLabel: string | null;
  marketplace: MarketplaceId;
  url: string;
  image: string | null;
  condition: string | null;
  location: string | null;
}

export interface SharedMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ShareSnapshot {
  title: string;
  /** Data della chat (ms). */
  chatDate: number;
  messages: SharedMessage[];
  products: SharedProduct[];
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_URL) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeProduct(raw: unknown): SharedProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const marketplace = MARKETPLACE_IDS.find((id) => id === p.marketplace);
  const title = str(p.title, 200);
  if (!marketplace || !title) return null;
  const id = typeof p.id === "string" ? p.id.slice(0, 40) : "";
  const rawUrl = httpUrl(p.url);
  if (!rawUrl) return null;
  const url = httpUrl(productHref({ marketplace, id, url: rawUrl }));
  if (!url) return null;
  const price = typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0 ? p.price : null;
  return {
    title,
    price,
    priceLabel: str(p.priceLabel, 40),
    marketplace,
    url,
    image: httpUrl(p.image),
    condition: str(p.condition, 60),
    location: str(p.location, 60),
  };
}

/** Valida e normalizza l'input del client. Restituisce null se non c'è nulla da condividere. */
export function buildSnapshot(input: unknown): ShareSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.messages)) return null;

  let messages: SharedMessage[] = [];
  const productMap = new Map<string, SharedProduct>();
  for (const item of raw.messages) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = typeof m.content === "string" ? m.content.trim().slice(0, MAX_MESSAGE_CHARS) : "";
    if (content) messages.push({ role: m.role, content });
    if (m.role === "assistant" && Array.isArray(m.products)) {
      for (const candidate of m.products) {
        const product = sanitizeProduct(candidate);
        if (product && !productMap.has(product.url) && productMap.size < SHARE_MAX_PRODUCTS) {
          productMap.set(product.url, product);
        }
      }
    }
  }

  messages = messages.slice(-SHARE_MAX_MESSAGES);
  // Tetto di dimensione: scarta i messaggi più vecchi finché il testo sta nel limite.
  const size = (list: SharedMessage[]) => list.reduce((sum, m) => sum + Buffer.byteLength(m.content), 0);
  while (messages.length > 1 && size(messages) > SHARE_MAX_BYTES) messages.shift();
  if (messages.length === 1 && size(messages) > SHARE_MAX_BYTES) {
    messages[0] = { ...messages[0], content: messages[0].content.slice(0, SHARE_MAX_BYTES / 4) };
  }
  if (!messages.some((m) => m.role === "assistant")) return null;

  const chatDate =
    typeof raw.chatDate === "number" && Number.isFinite(raw.chatDate) && raw.chatDate > 0
      ? Math.min(raw.chatDate, Date.now())
      : Date.now();
  return {
    title: str(raw.title, 120) ?? "Chat su Bazaar",
    chatDate,
    messages,
    products: Array.from(productMap.values()),
  };
}

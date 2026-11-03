import type { MarketplaceId, Product } from "@/lib/types";
import { formatPrice } from "@/lib/ui";

export { formatPrice };

export function parsePrice(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let value = input
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!value) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const decimals = value.length - lastComma - 1;
    value = decimals === 3 ? value.replace(/,/g, "") : value.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    if (decimals === 3) value = value.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\u00a0/g, " ").trim();
  return trimmed || null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return parsePrice(value);
}

function productKey(marketplace: MarketplaceId, id: string, url: string): string {
  return `${marketplace}:${id || url}`;
}

function safeUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
}

function imageUrl(value: unknown): string | null {
  const raw = safeUrl(value);
  return raw || null;
}

function idFromUrl(url: string, fallback: string): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || fallback;
  } catch {
    return fallback;
  }
}

function makeProduct(
  marketplace: MarketplaceId,
  id: string,
  title: string,
  priceLabel: string | null,
  price: number | null,
  url: string,
  extras: Partial<Product> = {},
): Product | null {
  if (!title || !url) return null;
  return {
    key: productKey(marketplace, id, url),
    marketplace,
    id: id || url,
    title,
    price: price ?? parsePrice(priceLabel),
    priceLabel: priceLabel || formatPrice(price),
    url,
    ...extras,
  };
}

export interface ToolOutput {
  data: unknown;
  products: Product[];
  rawText: string;
  error?: string;
  total?: number;
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some servers prepend a heading or a warning: try the outermost object.
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeToolOutput(
  server: MarketplaceId,
  tool: string,
  rawText: string,
): ToolOutput {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { data: null, products: [], rawText: "", error: "Risposta vuota dal marketplace." };
  }

  if (trimmed.startsWith("❌") || trimmed.startsWith("Errore")) {
    return {
      data: { errore: trimmed.replace(/^❌\s*/, "") },
      products: [],
      rawText: trimmed,
      error: trimmed.replace(/^❌\s*/, ""),
    };
  }

  const data = parseJsonLoose(trimmed);
  const record = asRecord(data);

  if (!record) {
    const looksLikeError = /non raggiungibile|errore|rate limit|blocco|timeout/i.test(trimmed);
    return {
      data: looksLikeError ? { errore: trimmed.slice(0, 500) } : null,
      products: [],
      rawText: trimmed,
      error: looksLikeError ? trimmed.slice(0, 500) : undefined,
    };
  }

  if (record.errore || record.error) {
    return {
      data: record,
      products: [],
      rawText: trimmed,
      error: String(record.errore || record.error).slice(0, 500),
    };
  }

  let products: Product[] = [];
  let total: number | undefined;

  if (server === "amazon") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    products = items
      .map((item, index) => {
        const row = asRecord(item);
        if (!row) return null;
        const url = safeUrl(row.url);
        const id = text(row.asin) || idFromUrl(url, `amazon-${index}`);
        const extras: Partial<Product> = {
          image: imageUrl(row.immagine),
          rating: num(row.valutazione),
          reviews: typeof row.recensioni === "number" ? row.recensioni : null,
          condition: "Nuovo",
          location: null,
          seller: "Amazon.it",
          extra: row.sponsorizzato ? "Sponsorizzato" : null,
        };
        return makeProduct("amazon", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, extras);
      })
      .filter((item): item is Product => Boolean(item));
  } else if (server === "aliexpress") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    products = items
      .map((item, index) => {
        const row = asRecord(item);
        if (!row) return null;
        const url = safeUrl(row.url);
        const id = text(row.id) || idFromUrl(url, `ali-${index}`);
        const notes = [
          text(row.vendite),
          row.spedizione_gratuita ? "Spedizione gratuita" : null,
        ].filter(Boolean);
        return makeProduct("aliexpress", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
          image: imageUrl(row.immagine),
          rating: num(row.valutazione),
          condition: "Nuovo",
          seller: "AliExpress",
          extra: notes.length ? notes.join(" · ") : null,
        });
      })
      .filter((item): item is Product => Boolean(item));
  } else if (server === "vinted") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    products = items
      .map((item, index) => {
        const row = asRecord(item);
        if (!row) return null;
        const url = safeUrl(row.url);
        const id = text(row.id) || idFromUrl(url, `vinted-${index}`);
        const notes = [
          text(row.brand),
          row.mi_piace ? `${row.mi_piace} mi piace` : null,
          text(row.prezzo_totale) && text(row.prezzo_totale) !== text(row.prezzo)
            ? `Con commissioni: ${text(row.prezzo_totale)}`
            : null,
        ].filter(Boolean);
        return makeProduct("vinted", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
          image: imageUrl(row.immagine),
          condition: text(row.condizioni) || "Usato",
          seller: "Venditore Vinted",
          extra: notes.length ? notes.join(" · ") : null,
        });
      })
      .filter((item): item is Product => Boolean(item));
  } else if (server === "subito") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    products = items
      .map((item, index) => {
        const row = asRecord(item);
        if (!row) return null;
        const url = safeUrl(row.link);
        const id = idFromUrl(url, `subito-${index}`);
        const date = text(row.data);
        return makeProduct("subito", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo), url, {
          condition: "Usato",
          location: text(row.luogo),
          seller: "Venditore Subito",
          extra: date ? `Pubblicato: ${date.slice(0, 10)}` : null,
        });
      })
      .filter((item): item is Product => Boolean(item));
  } else if (server === "facebook-marketplace") {
    const items = asArray(record.annunci);
    total = typeof record.totale === "number" ? record.totale : items.length;
    products = items
      .map((item, index) => {
        const row = asRecord(item);
        if (!row) return null;
        const url = safeUrl(row.url);
        const id = text(row.id) || idFromUrl(url, `fb-${index}`);
        const status = text(row.stato);
        return makeProduct("facebook-marketplace", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
          image: imageUrl(row.immagine),
          condition: text(row.condizione) || "Usato",
          location: text(row.luogo),
          seller: text(row.venditore),
          extra: status && status !== "disponibile" ? `Stato: ${status}` : null,
        });
      })
      .filter((item): item is Product => Boolean(item));
  } else if (tool.startsWith("get_")) {
    const detail = record;
    const url = safeUrl(detail.url);
    const id = text(detail.asin) || text(detail.id) || idFromUrl(url, `${server}-detail`);
    const title = text(detail.titolo) || text(detail.title) || "";
    const price = num(detail.prezzo_num) ?? num(detail.prezzo) ?? num(detail.price);
    const priceLabel = text(detail.prezzo) || text(detail.price);
    const extras: Partial<Product> = {
      image: imageUrl(detail.immagine) || imageUrl(detail.image),
      condition: text(detail.condizioni) || text(detail.condizione) || "Nuovo",
      location: text(detail.luogo),
      seller: text(detail.venditore),
      extra: text(detail.descrizione)?.slice(0, 220) || null,
    };
    const product = makeProduct(server, id, title, priceLabel, price, url, extras);
    products = product ? [product] : [];
  }

  return {
    data: record,
    products: dedupeProducts(products),
    rawText: trimmed,
    total,
  };
}

export function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const product of products) {
    const key = product.url || product.key;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(product);
  }
  return result;
}

function pick(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      out[key] = record[key];
    }
  }
  return out;
}

function shortUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/ref=.*$/, "").slice(0, 120);
  } catch {
    return raw.slice(0, 120);
  }
}

function essential(row: Record<string, unknown>, server: MarketplaceId): Record<string, unknown> {
  const priceRaw = row.prezzo_num ?? row.prezzo;
  const out: Record<string, unknown> = {};
  const title = text(row.titolo);
  if (title) out.titolo = title.slice(0, 90);
  const price = num(priceRaw);
  if (price != null) out.prezzo_num = price;
  const condition = text(row.condizioni) || text(row.condizione) || (server === "amazon" || server === "aliexpress" ? "nuovo" : undefined);
  if (condition) out.condizione = condition;
  const place = text(row.luogo);
  if (place) out.luogo = place.slice(0, 40);
  const url = shortUrl(row.url ?? row.link);
  if (url) out.url = url;
  return out;
}

/**
 * Riduce la risposta MCP a ciò che serve al modello (max ~8 item, solo campi
 * essenziali, tetto di caratteri). Il JSON completo resta al frontend per le card.
 */
export function compactToolOutputForModel(
  server: MarketplaceId,
  tool: string,
  output: ToolOutput,
  maxItems = 8,
  maxChars = 6_000,
): string {
  const record = asRecord(output.data);
  if (!record) {
    return output.rawText.slice(0, 2000) || JSON.stringify({ errore: output.error || "Nessun dato" });
  }

  if (record.errore || record.error) {
    return JSON.stringify({ errore: String(record.errore || record.error).slice(0, 400) });
  }

  if (tool.startsWith("get_")) {
    const picked = pick(record, [
      "titolo", "title", "prezzo", "prezzo_num", "price", "brand", "condizioni",
      "condizione", "disponibilita", "luogo", "venditore", "descrizione", "url", "valutazione", "stato",
    ]);
    if (typeof picked.descrizione === "string") picked.descrizione = picked.descrizione.slice(0, 900);
    if (typeof picked.url === "string") picked.url = shortUrl(picked.url);
    return JSON.stringify(picked).slice(0, maxChars);
  }

  const items = asArray(record.risultati ?? record.annunci ?? record.items ?? record.listings).slice(0, maxItems);
  const compactItems = items.map((item) => {
    const row = asRecord(item);
    return row ? essential(row, server) : item;
  });

  let payload = JSON.stringify({ fonte: server, totale: record.totale ?? items.length, risultati: compactItems });
  // Se supera il tetto, riduci gli item invece di troncare il JSON a metà.
  let keep = compactItems.length;
  while (payload.length > maxChars && keep > 1) {
    keep -= 1;
    payload = JSON.stringify({ fonte: server, totale: record.totale ?? items.length, risultati: compactItems.slice(0, keep) });
  }
  return payload.slice(0, maxChars);
}

/** Riassunto minimo (3 più economici) per sostituire i vecchi tool result nel contesto. */
export function summarizeToolContentForModel(content: string): string {
  try {
    const parsed = JSON.parse(content) as { fonte?: string; totale?: unknown; risultati?: Array<Record<string, unknown>>; errore?: string };
    if (parsed.errore) return content.slice(0, 200);
    if (!Array.isArray(parsed.risultati)) return content.slice(0, 400);
    const top = parsed.risultati
      .slice()
      .sort((a, b) => (Number(a.prezzo_num) || Infinity) - (Number(b.prezzo_num) || Infinity))
      .slice(0, 3)
      .map((row) => ({
        titolo: typeof row.titolo === "string" ? row.titolo.slice(0, 50) : undefined,
        prezzo_num: row.prezzo_num,
        url: row.url,
      }));
    return JSON.stringify({ fonte: parsed.fonte, riassunto: `${parsed.risultati.length} risultati, migliori 3`, top });
  } catch {
    return content.slice(0, 300);
  }
}

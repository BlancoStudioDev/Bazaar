import type { MarketplaceId, Product } from "@/lib/types";
import {
  MIN_SAMPLE_FOR_MEDIAN,
  median,
  nonProductReason,
  priceReason,
  queryKey,
  relevanceReason,
  type DiscardReason,
} from "@/lib/mcp/plausibility";
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
  /** Annunci scartati dai filtri di plausibilità (non vanno in Bacheca né al modello). */
  discarded?: { count: number; reasons: Partial<Record<DiscardReason, number>> };
}

/** Massimo di annunci tenuti per singola chiamata di ricerca (uguale per ogni marketplace). */
export const MAX_ITEMS_PER_CALL = 20;
/** Massimo di annunci per marketplace nel JSON per il modello. */
export const MAX_ITEMS_FOR_MODEL = 6;

const FB_ITEM_BASE = "https://www.facebook.com/marketplace/item/";

/** URL canonico dell'annuncio Facebook a partire dall'id numerico. */
export function facebookItemUrl(id: string | null | undefined): string | null {
  const clean = (id || "").trim();
  return /^\d{6,}$/.test(clean) ? `${FB_ITEM_BASE}${clean}/` : null;
}

// Prezzi osservati per query (tra marketplace diversi) per la mediana di riferimento.
const globalForPrices = globalThis as unknown as {
  __bazaarPricePool?: Map<string, { at: number; prices: number[] }>;
};
const PRICE_POOL_TTL_MS = 15 * 60 * 1000;

function pricePool() {
  if (!globalForPrices.__bazaarPricePool) globalForPrices.__bazaarPricePool = new Map();
  return globalForPrices.__bazaarPricePool;
}

function referenceMedian(key: string, ownPrices: number[]): number | null {
  if (!key) return ownPrices.length >= MIN_SAMPLE_FOR_MEDIAN ? median(ownPrices) : null;
  const pool = pricePool();
  const now = Date.now();
  for (const [poolKey, entry] of pool) {
    if (now - entry.at > PRICE_POOL_TTL_MS) pool.delete(poolKey);
  }
  const entry = pool.get(key);
  const prices = [...(entry?.prices ?? []), ...ownPrices].slice(-200);
  pool.set(key, { at: now, prices });
  return prices.length >= MIN_SAMPLE_FOR_MEDIAN ? median(prices) : null;
}

function queryFromRecord(record: Record<string, unknown>, args?: Record<string, unknown>): string {
  const fromArgs = typeof args?.query === "string" ? args.query : "";
  if (fromArgs.trim()) return fromArgs.trim();
  if (typeof record.query === "string" && record.query.trim()) return record.query.trim();
  if (typeof record.url === "string") {
    try {
      const q = new URL(record.url).searchParams.get("q");
      if (q) return q;
    } catch {
      // ignore
    }
  }
  return "";
}

/**
 * Applica pertinenza, non-prodotti/accessori e prezzi sospetti. Restituisce prodotti e righe
 * grezze allineate (con url/condizione normalizzati) così JSON modello e Bacheca coincidono.
 */
function curate(
  server: MarketplaceId,
  items: unknown[],
  mapped: Array<Product | null>,
  query: string,
): { products: Product[]; rows: unknown[]; discarded: NonNullable<ToolOutput["discarded"]> } {
  const reasons: Partial<Record<DiscardReason, number>> = {};
  const drop = (reason: DiscardReason) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  };

  type Entry = { product: Product; row: unknown };
  const stage: Entry[] = [];
  const seen = new Set<string>();
  mapped.forEach((product, index) => {
    if (!product) return;
    const dedupeKey = product.url || product.key;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (query) {
      const reason = nonProductReason(product.title, query) || relevanceReason(product.title, query);
      if (reason) return drop(reason);
    } else {
      const reason = nonProductReason(product.title, "");
      if (reason) return drop(reason);
    }
    if (server === "amazon" && product.price == null) return drop("senza_prezzo");
    stage.push({ product, row: items[index] });
  });

  const key = queryKey(query);
  const ownPrices = stage
    .map((entry) => entry.product.price)
    .filter((price): price is number => price != null && price > 0);
  const reference = referenceMedian(key, ownPrices);

  const kept: Entry[] = [];
  for (const entry of stage) {
    const reason = priceReason(entry.product.price, reference);
    if (reason) {
      drop(reason);
      continue;
    }
    kept.push(entry);
  }

  const limited = kept.slice(0, MAX_ITEMS_PER_CALL);
  const products = limited.map((entry) => ({ ...entry.product, query: query || entry.product.query || null }));
  const rows = limited.map((entry) => {
    const row = asRecord(entry.row);
    if (!row) return entry.row;
    return {
      ...row,
      url: entry.product.url,
      ...(entry.product.condition ? { condizione: entry.product.condition } : {}),
    };
  });
  const count = Object.values(reasons).reduce((sum, value) => sum + (value ?? 0), 0);
  return { products, rows, discarded: { count, reasons } };
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
  args?: Record<string, unknown>,
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
  let outData: Record<string, unknown> = record;
  let discarded: ToolOutput["discarded"];
  const query = queryFromRecord(record, args);

  const finishSearch = (listKey: string, items: unknown[], mapped: Array<Product | null>) => {
    const curated = curate(server, items, mapped, query);
    products = curated.products;
    discarded = curated.discarded;
    outData = {
      ...record,
      [listKey]: curated.rows,
      totale: curated.rows.length,
      ...(curated.discarded.count ? { scartati_sospetti: curated.discarded.count } : {}),
    };
  };

  if (server === "amazon") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const url = safeUrl(row.url);
      const id = text(row.asin) || idFromUrl(url, `amazon-${index}`);
      const title = text(row.titolo) || "";
      const refurbished = /ricondizionat|refurbished|renewed|\busato\b/i.test(title);
      const extras: Partial<Product> = {
        image: imageUrl(row.immagine),
        rating: num(row.valutazione),
        reviews: typeof row.recensioni === "number" ? row.recensioni : null,
        condition: refurbished ? "Ricondizionato" : "Nuovo",
        location: null,
        seller: "Amazon.it",
        extra: row.sponsorizzato ? "Sponsorizzato" : null,
      };
      return makeProduct("amazon", id, title, text(row.prezzo), num(row.prezzo_num), url, extras);
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "aliexpress") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
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
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "vinted") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
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
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "subito") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const url = safeUrl(row.link ?? row.url);
      const id = idFromUrl(url, `subito-${index}`);
      const date = text(row.data);
      return makeProduct("subito", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo), url, {
        condition: "Usato",
        location: text(row.luogo),
        seller: "Venditore Subito",
        extra: date ? `Pubblicato: ${date.slice(0, 10)}` : null,
      });
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "facebook-marketplace") {
    const items = asArray(record.annunci);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const rawUrl = safeUrl(row.url);
      const rawId = text(row.id) || text(row.listing_id) || (rawUrl.match(/\/marketplace\/item\/(\d+)/)?.[1] ?? "");
      // Sempre l'URL diretto dell'annuncio: l'url grezzo può puntare alla pagina generica.
      const url = facebookItemUrl(rawId) || (/\/marketplace\/item\/\d+/.test(rawUrl) ? rawUrl : "");
      const status = text(row.stato);
      return makeProduct("facebook-marketplace", rawId || `fb-${index}`, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
        image: imageUrl(row.immagine),
        condition: text(row.condizione) || "Usato",
        location: text(row.luogo),
        seller: text(row.venditore),
        extra: status && status !== "disponibile" ? `Stato: ${status}` : null,
      });
    });
    finishSearch("annunci", items, mapped);
  } else if (tool.startsWith("get_")) {
    const detail = record;
    const url =
      (server === "facebook-marketplace" && facebookItemUrl(text(detail.id))) || safeUrl(detail.url);
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
    data: outData,
    products: dedupeProducts(products),
    rawText: trimmed,
    total,
    discarded,
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
  maxItems = MAX_ITEMS_FOR_MODEL,
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

  const cityNote = record.filtro_citta
    ? { nota: items.length ? `solo annunci a ${record.filtro_citta}` : `NESSUN annuncio a ${record.filtro_citta}: dillo esplicitamente all'utente` }
    : {};
  const extraNote = { ...(record.scartati_sospetti ? { scartati_sospetti: record.scartati_sospetti } : {}), ...cityNote };
  let payload = JSON.stringify({ fonte: server, totale: record.totale ?? items.length, ...extraNote, risultati: compactItems });
  // Se supera il tetto, riduci gli item invece di troncare il JSON a metà.
  let keep = compactItems.length;
  while (payload.length > maxChars && keep > 1) {
    keep -= 1;
    payload = JSON.stringify({ fonte: server, totale: record.totale ?? items.length, ...extraNote, risultati: compactItems.slice(0, keep) });
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


const LOCATED_SERVERS = new Set<MarketplaceId>(["subito", "facebook-marketplace"]);

function foldPlace(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Se l'utente ha nominato una città, gli annunci locali (Subito, Facebook) devono
 * trovarsi lì: il modello non deve poter "dedurre" una località che l'annuncio non ha.
 * I marketplace senza località (Amazon, AliExpress, Vinted) restano invariati.
 */
export function filterOutputByCity(server: MarketplaceId, output: ToolOutput, city: string): ToolOutput {
  if (!LOCATED_SERVERS.has(server) || !city.trim()) return output;
  const wanted = foldPlace(city.trim());
  const matches = (place: unknown) => typeof place === "string" && foldPlace(place).includes(wanted);

  const products = output.products.filter((product) => matches(product.location));
  let data = output.data;
  const record = asRecord(output.data);
  if (record) {
    const key = ["risultati", "annunci", "items", "listings"].find((k) => Array.isArray(record[k]));
    if (key) {
      const kept = (record[key] as unknown[]).filter((item) => {
        const row = asRecord(item);
        return row ? matches(row.luogo ?? row.location ?? row.citta) : false;
      });
      data = { ...record, [key]: kept, totale: kept.length, filtro_citta: city };
    }
  }
  return { ...output, products, data };
}

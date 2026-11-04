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
import { MARKETPLACES } from "@/lib/marketplaces";
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

/** Miniature dei comparatori: Trovaprezzi serve 100x100 per default, ma esistono anche le 300x300. */
function upscaleThumbnail(url: string | null): string | null {
  if (!url) return url;
  return url
    .replace("/it-100x100/", "/it-300x300/")
    .replace(/tr=h-100(%2C|,)w-100/, "tr=h-300$1w-300");
}

function conditionFrom(value: unknown): string {
  const raw = text(value);
  if (!raw) return "Nuovo";
  if (/ricondizionat|refurbished|renewed/i.test(raw)) return "Ricondizionato";
  if (/usat|second\s*hand|seconda\s*mano|used/i.test(raw)) return "Usato";
  return /^nuov/i.test(raw) ? "Nuovo" : raw;
}

function withBrand(title: string | null, brand: string | null): string {
  const base = title || "";
  if (!brand || !base) return base;
  return base.toLowerCase().includes(brand.toLowerCase().split(" ")[0]) ? base : `${brand} ${base}`;
}

function comparatorId(server: MarketplaceId, url: string, page: string | null, index: number): string {
  // Chiavi stabili e uniche: i link di tracciamento condividono il percorso (/relocator/relocate), cambiano i parametri.
  try {
    const parsed = new URL(url);
    const offer = parsed.searchParams.get("offerKey");
    if (offer) return `${server}-${offer}`;
    const goto = parsed.pathname.match(/\/goto\/(\d+)/)?.[1];
    if (goto) return `${server}-${goto}`;
  } catch {
    // ignore
  }
  const pageId = page?.match(/\/(\d{6,})\//)?.[1];
  return pageId ? `${server}-${pageId}` : `${server}-${index}`;
}

function isSpanishPlace(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(",").map((part) => foldPlace(part.trim()));
  // «Barcelona, Barcelona»: provincia (ultimo elemento) spagnola.
  return parts.length > 0 && SPANISH_PLACES.has(parts[parts.length - 1]);
}

/** Testo di descrizione pulito per il modello: niente HTML, URL, hashtag; spazi compattati; troncato. */
export function cleanDescription(value: unknown, max = 300): string | null {
  if (max <= 0) return null;
  const raw = Array.isArray(value) ? value.filter((v) => typeof v === "string").join(" | ") : value;
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

/** Descrizione dal risultato di un tool di dettaglio (descrizione, oppure elenco caratteristiche). */
export function descriptionFromDetail(data: unknown, max = 300): string | null {
  const record = asRecord(data);
  if (!record) return null;
  return cleanDescription(record.descrizione ?? record.description, max) || cleanDescription(record.caratteristiche, max);
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
  /** Query effettivamente cercata (serve a decidere quali dettagli, es. le taglie, mandare al modello). */
  query?: string;
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
/** Massimo di annunci per marketplace nel JSON per il modello (fino a MANY_STORES_AFTER negozi interrogati). */
export const MAX_ITEMS_FOR_MODEL = 6;
/** Oltre questo numero di negozi interrogati nello stesso giro il modello riceve meno annunci per negozio. */
export const MANY_STORES_AFTER = 6;
export const MAX_ITEMS_FOR_MODEL_MANY = 4;
/** Tetto totale di caratteri dei tool result per giro (≈ 5-6k token). */
export const MAX_TOTAL_TOOL_CHARS = 19_000;

/** Annunci per negozio e caratteri per tool result da mandare al modello, in base a quanti negozi sono stati interrogati. */
export function modelBudget(searchCount: number): { items: number; chars: number } {
  return searchCount > MANY_STORES_AFTER
    ? { items: MAX_ITEMS_FOR_MODEL_MANY, chars: 3_400 }
    : { items: MAX_ITEMS_FOR_MODEL, chars: 6_000 };
}

/** Comparatori di prezzo: il «venditore» è il negozio che offre il prezzo, non il sito. */
const COMPARATORS = new Set<MarketplaceId>(["trovaprezzi", "idealo"]);
/** Negozi nuovi (retail): `condizione` assente = nuovo, e non spostano troppo la mediana dei prezzi. */
const RETAIL = new Set<MarketplaceId>(["trovaprezzi", "idealo", "mediaworld", "unieuro", "zalando"]);
/** Massimo di prezzi per chiamata che un negozio retail aggiunge alla mediana di riferimento. */
const RETAIL_POOL_SAMPLE = 8;

/** Province spagnole: l'API di Wallapop a volte mescola annunci spagnoli ai risultati italiani. */
const SPANISH_PLACES = new Set(
  [
    "barcelona", "madrid", "valencia", "sevilla", "zaragoza", "malaga", "murcia", "alicante", "bilbao",
    "vizcaya", "bizkaia", "granada", "cordoba", "valladolid", "pontevedra", "a coruna", "la coruna",
    "asturias", "baleares", "illes balears", "las palmas", "santa cruz de tenerife", "girona", "gerona",
    "tarragona", "lleida", "navarra", "cantabria", "toledo", "badajoz", "caceres", "cadiz", "huelva",
    "jaen", "almeria", "castellon", "albacete", "guipuzcoa", "gipuzkoa", "alava", "la rioja", "leon",
    "burgos", "salamanca", "lugo", "ourense", "tenerife", "mallorca", "ibiza",
  ].map((value) => value),
);

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
    // I comparatori ripetono la stessa offerta con link di tracciamento diversi: stesso prodotto, negozio e prezzo.
    if (COMPARATORS.has(server)) {
      const sameOffer = `${product.title}|${product.seller}|${product.price}`.toLowerCase();
      if (seen.has(sameOffer)) return;
      seen.add(sameOffer);
    }
    if (query) {
      const reason =
        nonProductReason(product.title, query) ||
        relevanceReason(product.title, query, { digitsOnly: server === "zalando" });
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
  // I negozi retail contribuiscono con un campione limitato: la mediana non deve spostarsi verso i prezzi
  // di listino e far passare per «sospetti» gli affari dell'usato.
  const reference = referenceMedian(key, RETAIL.has(server) ? ownPrices.slice(0, RETAIL_POOL_SAMPLE) : ownPrices);

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
  let searchedQuery: string | undefined;
  const query = queryFromRecord(record, args);

  const finishSearch = (listKey: string, items: unknown[], mapped: Array<Product | null>) => {
    const curated = curate(server, items, mapped, query);
    products = curated.products;
    discarded = curated.discarded;
    searchedQuery = query;
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
  } else if (server === "ebay") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const url = safeUrl(row.url);
      const id = text(row.id) || idFromUrl(url, `ebay-${index}`);
      const sold = text(row.venduto_il);
      const notes = [sold ? `Venduto il ${sold}` : null, text(row.formato), text(row.spedizione)].filter(Boolean);
      // Prezzo di VENDITA in USD/GBP: l'etichetta porta il simbolo della valuta, ma `price`
      // resta null così non entra mai in ordinamento, "più basso" e mediane plausibilità
      // (che ragionano in euro) mescolandosi con gli annunci acquistabili.
      const label = text(row.prezzo) || null;
      const product = makeProduct("ebay", id, text(row.titolo) || "", label, null, url, {
        image: imageUrl(row.immagine),
        condition: text(row.condizioni),
        location: text(row.luogo),
        seller: "Venduto su eBay",
        extra: notes.length ? notes.join(" · ") : null,
      });
      if (product) {
        product.price = null;
        if (!label) product.priceLabel = null;
      }
      return product;
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
      const notes = [
        subitoShipping(row),
        text(row.categoria),
        date ? `Pubblicato: ${date.slice(0, 10)}` : null,
      ].filter(Boolean);
      return makeProduct("subito", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num ?? row.prezzo), url, {
        image: imageUrl(row.immagine),
        condition: text(row.condizione) || "Usato",
        location: text(row.luogo),
        seller: subitoSeller(row),
        extra: notes.length ? notes.join(" · ") : null,
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
  } else if (server === "wallapop") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      if (isSpanishPlace(row.luogo)) return null;
      const url = safeUrl(row.link ?? row.url);
      const id = idFromUrl(url, `wallapop-${index}`);
      const date = text(row.data);
      return makeProduct("wallapop", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
        image: imageUrl(row.immagine),
        // L'API di ricerca non espone condizione e venditore: Wallapop qui è sempre seconda mano tra privati.
        condition: text(row.condizione) || "Usato",
        location: text(row.luogo),
        seller: text(row.venditore) || "Privato",
        extra: date ? `Pubblicato: ${date.slice(0, 10)}` : null,
      });
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "trovaprezzi" || server === "idealo") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      // `link` è il redirect di tracciamento verso il negozio; `pagina_prodotto` la scheda di confronto.
      const page = safeUrl(row.pagina_prodotto) || null;
      const url = safeUrl(row.link ?? row.url) || page || "";
      const id = comparatorId(server, url, page, index);
      const offers = typeof row.n_offerte === "number" && row.n_offerte > 1 ? `${row.n_offerte} offerte` : null;
      const shop = text(row.negozio);
      const product = makeProduct(server, id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
        image: upscaleThumbnail(imageUrl(row.immagine)),
        condition: conditionFrom(row.condizione),
        seller: shop,
        extra: [shop ? `Da ${shop}` : null, offers].filter(Boolean).join(" · ") || null,
        pageUrl: page,
      });
      return product;
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "mediaworld") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const url = safeUrl(row.link ?? row.url);
      const id = url.match(/-(\d{6,})\.html/)?.[1] || idFromUrl(url, `mediaworld-${index}`);
      const description = text(row.descrizione);
      const sold = description?.match(/Venduto da (.+?)(?:\.|$)/i)?.[1]?.trim();
      const notes = [
        text(row.sconto) ? `Sconto ${text(row.sconto)}${text(row.prezzo_originale) ? ` (listino ${text(row.prezzo_originale)})` : ""}` : null,
        text(row.disponibilita),
      ].filter(Boolean);
      return makeProduct("mediaworld", id, withBrand(text(row.titolo), text(row.marca)), text(row.prezzo), num(row.prezzo_num), url, {
        image: imageUrl(row.immagine),
        condition: conditionFrom(row.condizione),
        seller: sold || "MediaWorld",
        extra: notes.length ? notes.join(" · ") : null,
      });
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "zalando") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const url = safeUrl(row.link ?? row.url);
      const id = url.match(/-([a-z0-9]{6,}-[a-z0-9]{3})\.html/i)?.[1] || idFromUrl(url, `zalando-${index}`);
      const notes = [
        text(row.sconto) ? `Saldo ${text(row.sconto)}${text(row.prezzo_originale) ? ` (listino ${text(row.prezzo_originale)})` : ""}` : null,
      ].filter(Boolean);
      return makeProduct("zalando", id, withBrand(text(row.titolo), text(row.marca)), text(row.prezzo), num(row.prezzo_num), url, {
        image: imageUrl(row.immagine),
        condition: conditionFrom(row.condizione),
        seller: "Zalando",
        extra: notes.length ? notes.join(" · ") : null,
      });
    });
    finishSearch("risultati", items, mapped);
  } else if (server === "unieuro") {
    const items = asArray(record.risultati);
    total = typeof record.totale === "number" ? record.totale : items.length;
    const mapped = items.map((item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const url = safeUrl(row.link ?? row.url);
      const id = idFromUrl(url, `unieuro-${index}`);
      // `luogo` è «Online (spedizione o ritiro in negozio)»: non è una località, non va nel campo luogo.
      return makeProduct("unieuro", id, text(row.titolo) || "", text(row.prezzo), num(row.prezzo_num), url, {
        image: imageUrl(row.immagine),
        condition: conditionFrom(row.condizione),
        seller: text(row.venditore) || "Unieuro",
        extra: "Spedizione o ritiro in negozio",
      });
    });
    finishSearch("risultati", items, mapped);
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
      extra: descriptionFromDetail(detail, 300),
    };
    const product = makeProduct(server, id, title, priceLabel, price, url, extras);
    products = product ? [product] : [];
  }

  return {
    query: searchedQuery,
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

function shortUrl(value: unknown, max = 120): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/ref=.*$/, "").slice(0, max);
  } catch {
    return raw.slice(0, max);
  }
}

function essential(
  row: Record<string, unknown>,
  server: MarketplaceId,
  options: { query?: string } = {},
): Record<string, unknown> {
  const priceRaw = row.prezzo_num ?? row.prezzo;
  const out: Record<string, unknown> = {};
  const title = text(row.titolo);
  if (title) out.titolo = title.slice(0, RETAIL.has(server) ? 80 : 90);
  const price = num(priceRaw);
  if (server === "ebay") {
    // Venduto in USD/GBP: mai un numero nudo (il modello lo scambierebbe per euro).
    const label = text(row.prezzo);
    if (label) out.prezzo_venduto = label;
    const currency = text(row.valuta);
    if (currency) out.valuta = currency;
    const sold = text(row.venduto_il);
    if (sold) out.venduto_il = sold;
  } else if (price != null) out.prezzo_num = price;
  const condition = text(row.condizioni) || text(row.condizione) || (server === "amazon" || server === "aliexpress" ? "nuovo" : undefined);
  // Nei negozi nuovi (comparatori, MediaWorld, Unieuro, Zalando) «nuovo» è la norma: si scrive solo l'eccezione.
  if (condition && !(RETAIL.has(server) && /^nuov/i.test(condition))) out.condizione = condition;
  const place = server === "unieuro" ? null : text(row.luogo);
  if (place) out.luogo = place.slice(0, 40);
  const format = text(row.formato);
  if (format) out.formato = format;
  // Comparatori: il link di tracciamento è lungo e non sopravvive al taglio dei parametri; al modello va la scheda di confronto.
  // I percorsi dei negozi (MediaWorld, idealo...) sono lunghi: tagliati a metà non aprono più la pagina.
  const url = shortUrl(
    COMPARATORS.has(server) ? row.pagina_prodotto ?? row.url ?? row.link : row.url ?? row.link,
    RETAIL.has(server) ? 220 : 120,
  );
  if (url) out.url = url;
  if (server === "subito") {
    const shipping = subitoShipping(row);
    if (shipping) out.spedizione = shipping;
    const seller = text(row.venditore);
    if (seller) out.venditore = seller.slice(0, 40);
    const date = text(row.data);
    if (date) out.data = date.slice(0, 10);
  }
  if (COMPARATORS.has(server)) {
    const shop = text(row.negozio);
    if (shop) out.negozio = shop.slice(0, 30);
    if (typeof row.n_offerte === "number" && row.n_offerte > 1) out.n_offerte = row.n_offerte;
  }
  if (server === "mediaworld" || server === "zalando") {
    const discount = text(row.sconto);
    if (discount) out.sconto = discount;
  }
  if (server === "wallapop") {
    const date = text(row.data);
    if (date) out.data = date.slice(0, 10);
  }
  if (server === "zalando" && Array.isArray(row.taglie) && options.query && /(?:^|[^\d.,])(?:2[89]|3\d|4\d|5[0-2])(?:[.,]5)?(?!\d)/.test(options.query)) {
    // Le taglie costano token: solo se la ricerca ne nomina una.
    out.taglie = row.taglie.filter((size) => typeof size === "string").slice(0, 24).join(",");
  }
  // Solo i candidati arricchiti (vedi agent/enrich.ts) portano una descrizione.
  const description = cleanDescription(row.descrizione, Math.min(240, descriptionCap(server)));
  if (description) out.descrizione = description;
  return out;
}

/** Lunghezza massima della descrizione per il modello; 0 = mai (testi promozionali, descrizioni di foto). */
export function descriptionCap(server: MarketplaceId): number {
  switch (server) {
    case "trovaprezzi":
    case "zalando":
    case "unieuro":
      return 0;
    case "idealo":
    case "mediaworld":
      return 140;
    default:
      return 300;
  }
}

/** "Spedizione 0,99 €" / "Solo ritiro a mano" dai campi del server Subito (null se il dato manca). */
function subitoShipping(row: Record<string, unknown>): string | null {
  if (typeof row.spedizione !== "boolean") return null;
  if (!row.spedizione) return "Solo ritiro a mano";
  const cost = text(row.costo_spedizione);
  return cost ? `Spedizione ${cost}` : "Spedizione disponibile";
}

function subitoSeller(row: Record<string, unknown>): string {
  const seller = text(row.venditore);
  if (!seller) return "Venditore Subito";
  return seller === "privato" ? "Privato" : seller.replace(/^negozio/, "Negozio");
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
      "condizione", "disponibilita", "luogo", "venditore", "descrizione", "url", "valutazione", "stato", "formato", "spedizione",
      "valuta", "venduto_il", "feedback", "attributi", "vendite", "stato_annuncio",
    ]);
    if (server === "ebay") delete picked.prezzo_num;
    if (typeof picked.descrizione === "string") picked.descrizione = picked.descrizione.slice(0, 900);
    if (typeof picked.url === "string") picked.url = shortUrl(picked.url);
    return JSON.stringify(picked).slice(0, maxChars);
  }

  const items = asArray(record.risultati ?? record.annunci ?? record.items ?? record.listings).slice(0, maxItems);
  const compactItems = items.map((item) => {
    const row = asRecord(item);
    return row ? essential(row, server, { query: output.query }) : item;
  });

  const notes = [
    // Le note dei comparatori sono sui limiti dello scraping, non servono al modello.
    COMPARATORS.has(server) ? null : text(record.nota),
    record.filtro_citta
      ? items.length ? `solo annunci a ${record.filtro_citta}` : `NESSUN annuncio a ${record.filtro_citta}: dillo esplicitamente all'utente`
      : null,
  ].filter(Boolean);
  // Subito dice quanti annunci corrispondono in tutto e quali filtri ha applicato davvero.
  const filters = asRecord(record.filtri);
  const extraNote = {
    ...(typeof record.disponibili === "number" ? { disponibili: record.disponibili } : {}),
    ...(filters && Object.keys(filters).length ? { filtri: filters } : {}),
    ...(record.scartati_sospetti ? { scartati_sospetti: record.scartati_sospetti } : {}),
    ...(server === "ebay"
      ? {
          ...(text(record.valuta) ? { valuta: text(record.valuta) } : {}),
          ...(text(record.sito) ? { sito: text(record.sito) } : {}),
          ...(asRecord(record.statistiche) ? { statistiche_vendite: record.statistiche } : {}),
          avviso: "VENDUTI (non acquistabili), valuta indicata, non euro",
        }
      : {}),
    ...(notes.length ? { nota: notes.join(" · ") } : {}),
  };
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
        prezzo_venduto: row.prezzo_venduto,
        url: row.url,
      }));
    return JSON.stringify({ fonte: parsed.fonte, riassunto: `${parsed.risultati.length} risultati, migliori 3`, top });
  } catch {
    return content.slice(0, 300);
  }
}


const LOCATED_SERVERS = new Set<MarketplaceId>(["subito", "facebook-marketplace", "wallapop"]);

function foldPlace(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Se l'utente ha nominato una città, gli annunci locali (Subito, Facebook) devono
 * trovarsi lì: il modello non deve poter "dedurre" una località che l'annuncio non ha.
 * I marketplace senza località (Amazon, AliExpress, Vinted, negozi e comparatori) restano invariati.
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

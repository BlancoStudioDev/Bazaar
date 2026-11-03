/**
 * Filtri di plausibilità per i risultati dei marketplace.
 * Puro (nessuna dipendenza da Node): usato sia in normalize.ts (server) sia nella
 * Bacheca (client) come rete di sicurezza.
 */

/** Sotto questa frazione della mediana un prezzo è considerato sospetto (scatola, civetta...). */
export const PRICE_SUSPECT_RATIO = 0.28;
/** Prezzi <= a questa soglia sono sospetti quando la mediana è almeno TINY_PRICE_MIN_MEDIAN. */
export const TINY_PRICE_EUR = 2;
export const TINY_PRICE_MIN_MEDIAN = 20;
/** Campione minimo per fidarsi della mediana. */
export const MIN_SAMPLE_FOR_MEDIAN = 3;

export type DiscardReason =
  | "non_prodotto"
  | "accessorio"
  | "non_pertinente"
  | "prezzo_sospetto"
  | "senza_prezzo";

export function queryKey(query: string | null | undefined): string {
  return (query || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Normalizza capacità e unità ("128 GB" -> "128gb", "128/256GB" -> "128gb 256gb", "4+128GB" -> "4 128gb"). */
function normalizeText(value: string): string {
  return fold(value)
    .replace(/(\d+)((?:\s*[/,]\s*\d+)+)\s*(gb|tb)/g, (_m, first: string, rest: string, unit: string) => {
      const parts = [first, ...rest.split(/[/,]/).map((part) => part.trim()).filter(Boolean)];
      return parts.map((part) => `${part}${unit}`).join(" ");
    })
    .replace(/(\d+)\s*\+\s*(\d+)\s*(gb|tb)/g, "$1 $2$3")
    .replace(/(\d)\s+(gb|tb|mb|mah|hz|w|ml|kg|cm|mm|mp)\b/g, "$1$2");
}

function tokens(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// --- Non-prodotti ---------------------------------------------------------

const NON_PRODUCT_PATTERNS: RegExp[] = [
  /\bsolo\s+(?:la\s+|il\s+)?(?:scatola|box|confezione|scatolo)\b/,
  /\b(?:scatola|box|confezione)\s+vuot[ao]\b/,
  /\bscatola\s+(?:di|per|originale)\b/,
  /^\s*(?:scatola|scatolo|box|confezione)\b/,
  /\b(?:only|empty)\s+box\b/,
  /\bper\s+(?:pezzi\s+di\s+)?ricambi\b/,
  /\bpezzi\s+di\s+ricambio\b/,
  /\bfor\s+parts\b/,
  /\bnon\s+funzionante\b/,
  /\bnon\s+funziona\b/,
  /\b(?:difettos[oa]|rott[oa]|guast[oa])\b/,
  /\b(?:schermo|display)\s+rott[oa]\b/,
  /\bicloud\s+bloccat[oa]\b|\bbloccat[oa]\s+icloud\b/,
];

const NON_PRODUCT_QUERY_ALLOW =
  /\b(?:scatola|box|confezione|ricambi|ricambio|difettos|rott|guast|non\s+funzion|bloccat|parts)/;

const INCLUSION_BEFORE = /(?:con|completo\s+di|compres[ao]|incluso|include|più|piu|\+|with)\s*$/;

export function nonProductReason(title: string, query: string): DiscardReason | null {
  const q = fold(query);
  const t = fold(title);
  if (!NON_PRODUCT_QUERY_ALLOW.test(q)) {
    for (const pattern of NON_PRODUCT_PATTERNS) {
      const match = pattern.exec(t);
      if (!match) continue;
      const before = t.slice(Math.max(0, match.index - 16), match.index);
      if (INCLUSION_BEFORE.test(before)) continue;
      return "non_prodotto";
    }
  }
  return accessoryReason(t, q);
}

const ACCESSORY_WORD =
  /\b(?:custodia|custodie|cover|pellicola|pellicole|vetro\s+temperato|protezione\s+schermo|protezioni\s+schermo|proteggi\s*schermo|screen\s+protector|tempered\s+glass|cinturino|cinturini|caricabatterie|caricatore|cavo|cavi|adattatore|supporto|case|astuccio|skin|sticker|adesivo|mouse\s*pad)\b/;
const ACCESSORY_QUERY_WORD =
  /\b(?:custodia|custodie|cover|pellicola|pellicole|vetro|protezione|proteggi|screen|glass|cinturino|cinturini|caricabatterie|caricatore|cavo|cavi|adattatore|supporto|case|astuccio|skin|sticker|adesivo|accessori|accessorio)/;
const ACCESSORY_FOR =
  /\b(?:compatibile|compatibili|adatto|adatta|per)\s+(?:con\s+)?(?:apple\s+)?(?:iphone|ipad|airpods|macbook|samsung|galaxy|xiaomi|redmi|huawei|pixel|playstation|ps5|switch)\b/;

function accessoryReason(t: string, q: string): DiscardReason | null {
  if (ACCESSORY_QUERY_WORD.test(q)) return null;
  const word = ACCESSORY_WORD.exec(t);
  if (word) {
    const before = t.slice(Math.max(0, word.index - 16), word.index);
    // "smartphone ... include custodia" è un telefono, non un accessorio.
    if (!INCLUSION_BEFORE.test(before)) return "accessorio";
  }
  if (!/\bper\b/.test(q) && ACCESSORY_FOR.test(t) && !/^\s*(?:apple\s+)?(?:iphone|ipad|macbook|samsung|galaxy|xiaomi|redmi|huawei|pixel)\b/.test(t)) {
    return "accessorio";
  }
  return null;
}

// --- Pertinenza -----------------------------------------------------------

const STOPWORDS = new Set([
  "nuovo", "nuova", "nuovi", "nuove", "usato", "usata", "usati", "originale", "originali",
  "con", "per", "della", "dello", "delle", "garanzia", "ricondizionato", "ricondizionata",
  "economico", "economica", "offerta", "sotto", "circa", "colore", "pollici", "taglia",
  "misura", "uomo", "donna", "bambino", "bambina", "vendita", "cerco",
]);

const SIZE_QUERY = /\b(?:scarpe|scarpa|sneaker|sneakers|stivali|taglia|misura|numero|size|pantaloni|jeans|giacca|felpa|maglia|abito|vestito)\b/;

function hasToken(titleTokens: Set<string>, normalizedTitle: string, token: string): boolean {
  if (titleTokens.has(token)) return true;
  // "15pro" contiene "15"; "128gb" è già normalizzato.
  if (/^\d+$/.test(token)) {
    return new RegExp(`(?<![a-z0-9])${token}(?![0-9])`).test(normalizedTitle);
  }
  // Capacità: "12gb" deve combaciare con "12G", "12 GB", "12gb".
  const unit = token.match(/^(\d+)(gb|tb|mb)$/);
  if (unit) {
    return new RegExp(`(?<![0-9a-z])${unit[1]}\\s?${unit[2][0]}b?(?![a-z0-9])`).test(normalizedTitle);
  }
  return false;
}

/**
 * Pertinenza: i token con cifre della query (modello, capacità) devono comparire nel titolo
 * ; senza cifre, almeno un terzo delle parole significative deve essere presente.
 * Nessuna lista di varianti: Pro/Super/Ti ecc. restano e le distingue il modello.
 */
export function relevanceReason(title: string, query: string): DiscardReason | null {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return null;
  const normalizedTitle = normalizeText(title);
  const titleTokens = new Set(tokens(title));
  const q = fold(query);
  const sizeQuery = SIZE_QUERY.test(q);

  const digitTokens = queryTokens.filter((token) => /\d/.test(token));
  for (const token of digitTokens) {
    if (sizeQuery && /^\d{2}$/.test(token) && Number(token) >= 28 && Number(token) <= 52) continue;
    if (!hasToken(titleTokens, normalizedTitle, token)) return "non_pertinente";
  }

  const words = queryTokens.filter(
    (token) => token.length >= 4 && !/\d/.test(token) && !STOPWORDS.has(token),
  );
  // Con un numero di modello nella query l'identità è già verificata dalle cifre:
  // parole generiche come "scheda video" non devono scartare risultati validi.
  if (words.length && !digitTokens.length) {
    const matched = words.filter((word) => {
      if (titleTokens.has(word)) return true;
      const stem = word.slice(0, Math.max(4, word.length - 2));
      return normalizedTitle.includes(stem);
    });
    if (matched.length === 0 || matched.length / words.length < 0.34) return "non_pertinente";
  }
  return null;
}

// --- Prezzi ---------------------------------------------------------------

export function priceReason(price: number | null, reference: number | null): DiscardReason | null {
  if (price == null || reference == null || !(reference > 0)) return null;
  if (price <= TINY_PRICE_EUR && reference >= TINY_PRICE_MIN_MEDIAN) return "prezzo_sospetto";
  if (price < reference * PRICE_SUSPECT_RATIO) return "prezzo_sospetto";
  return null;
}

interface PriceLike {
  price: number | null;
  title: string;
  query?: string | null;
}

/**
 * Rete di sicurezza lato Bacheca: per gruppo di ricerca (stessa query) scarta i prezzi
 * sospetti rispetto alla mediana. Prodotti senza query restano invariati.
 */
export function dropSuspiciousPrices<T extends PriceLike>(products: T[]): T[] {
  const groups = new Map<string, number[]>();
  for (const product of products) {
    const key = queryKey(product.query);
    if (!key || product.price == null || product.price <= 0) continue;
    const list = groups.get(key) ?? [];
    list.push(product.price);
    groups.set(key, list);
  }
  const medians = new Map<string, number | null>();
  for (const [key, prices] of groups) {
    medians.set(key, prices.length >= MIN_SAMPLE_FOR_MEDIAN ? median(prices) : null);
  }
  return products.filter((product) => {
    const key = queryKey(product.query);
    if (!key) return true;
    return !priceReason(product.price, medians.get(key) ?? null);
  });
}

import type { MarketplaceId, ToolActivity } from "@/lib/types";

/**
 * Voce di Fiuto, la volpe del deserto mercante di bazar ("avere fiuto per gli affari").
 * Frasi brevi, ironiche ma non sguaiate, legate a ciò che sta succedendo davvero:
 * il marketplace che risponde, la lettura delle descrizioni, il confronto dei prezzi.
 */

export type Phase = "start" | "searching" | "reading" | "comparing" | "writing" | "slow";

const START = [
  "Fiuto drizza le orecchie…",
  "Fiuto apre la bancarella, un attimo…",
  "Fiuto annusa l'aria: c'è profumo di affare…",
  "Fiuto sistema la tenda e comincia…",
];

const BY_MARKETPLACE: Record<MarketplaceId, string[]> = {
  amazon: [
    "Fiuto bussa al magazzino di Amazon…",
    "Tra i pacchi di Amazon c'è odore di affare…",
    "Scaffale dopo scaffale su Amazon…",
  ],
  aliexpress: [
    "Fiuto parte per AliExpress: viaggio lungo…",
    "Contratto con un venditore dall'altra parte del mondo…",
    "Sul banco di AliExpress, tra mille lucine…",
  ],
  vinted: [
    "Frugo negli armadi di Vinted…",
    "Su Vinted c'è sempre un tesoro in fondo al cassetto…",
    "Fiuto controlla le taglie e i prezzi su Vinted…",
  ],
  subito: [
    "Giro tra le bancarelle dell'usato su Subito…",
    "Su Subito qualcuno vende proprio quello che cerchi…",
    "Fiuto bussa alla porta dei vicini su Subito…",
  ],
  ebay: ["Fiuto passa all'asta di eBay…", "Su eBay si rilancia: Fiuto tiene il naso sul prezzo…"],
  "facebook-marketplace": [
    "Chiedo ai vicini su Facebook Marketplace…",
    "Fiuto sbircia le vetrine di quartiere…",
    "Su Marketplace si tratta con una stretta di mano…",
  ],
};

const MANY = [
  "Fiuto corre di bancarella in bancarella…",
  "Fiuto fa il giro del bazar, tutto in parallelo…",
  "Cinque bancarelle, un solo naso…",
];

const READING = [
  "Leggo le descrizioni: i titoli raccontano solo metà storia…",
  "Fiuto controlla le scritte piccole…",
  "Cerco l'inghippo nelle descrizioni…",
];

const COMPARING = [
  "Metto in fila i prezzi, dal più furbo al più caro…",
  "Faccio i conti sul retro di un sacchetto…",
  "Scarto le trappole e tengo gli affari…",
];

const WRITING = ["Fiuto prepara il verdetto…", "Ultimo sguardo ai prezzi e ve lo dico…"];

const SLOW = [
  "Il bazar è affollato oggi, ancora un momento…",
  "Qualche bancarella risponde piano, aspetto con pazienza…",
  "Fiuto non molla: sta ancora contrattando…",
];

/** Frasi per i tool nella timeline (voce di Fiuto, ma restano chiare su cosa succede). */
export const TOOL_LABELS: Record<string, string> = {
  search_amazon: "Annuso Amazon",
  get_product: "Apro la scheda Amazon",
  search_ebay: "Annuso eBay",
  get_ebay_item: "Apro l'annuncio eBay",
  search_aliexpress: "Annuso AliExpress",
  search_vinted: "Frugo su Vinted",
  get_item: "Apro l'annuncio Vinted",
  search_subito: "Giro su Subito",
  search_marketplace: "Chiedo su Facebook Marketplace",
  get_listing: "Apro l'annuncio Facebook",
  search_location: "Cerco la località",
};

const SERVER_NAMES: Record<MarketplaceId, string> = {
  amazon: "Amazon",
  aliexpress: "AliExpress",
  vinted: "Vinted",
  subito: "Subito",
  ebay: "eBay",
  "facebook-marketplace": "Facebook Marketplace",
};

/** Cambia frase ogni 3,5 s; il seed (es. l'id del messaggio) evita che ogni ricerca parta con la stessa. */
export const ROTATE_MS = 3_500;
const SLOW_AFTER_MS = 22_000;

function pick(pool: string[], tick: number, seed: number): string {
  return pool[(tick + seed) % pool.length];
}

export function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function detectPhase(input: {
  activities: ToolActivity[];
  hasText: boolean;
  elapsedMs: number;
}): Phase {
  const { activities, hasText, elapsedMs } = input;
  if (hasText) return "writing";
  if (!activities.length) return elapsedMs > SLOW_AFTER_MS ? "slow" : "start";
  const running = activities.some((a) => a.status === "running");
  if (running) return elapsedMs > SLOW_AFTER_MS ? "slow" : "searching";
  const detail = activities.some((a) => /^get_/.test(a.tool));
  return detail ? "reading" : "comparing";
}

/**
 * Frase di attesa coerente con lo stato reale. `elapsedMs` è il tempo dall'invio della richiesta.
 * Con `prefers-reduced-motion` il chiamante può semplicemente non animare il cambio testo.
 */
export function statusPhrase(input: {
  activities: ToolActivity[];
  hasText: boolean;
  elapsedMs: number;
  seed?: number;
}): string {
  const { activities, hasText, elapsedMs, seed = 0 } = input;
  const tick = Math.floor(elapsedMs / ROTATE_MS);
  switch (detectPhase({ activities, hasText, elapsedMs })) {
    case "start":
      return pick(START, tick, seed);
    case "searching": {
      const running = activities.filter((a) => a.status === "running");
      const servers = [...new Set(running.map((a) => a.server))].filter(
        (s): s is MarketplaceId => s in BY_MARKETPLACE,
      );
      if (servers.length >= 3) return pick(MANY, tick, seed);
      if (!servers.length) return pick(START, tick, seed);
      const server = servers[(tick + seed) % servers.length];
      return pick(BY_MARKETPLACE[server], Math.floor(tick / servers.length), seed);
    }
    case "reading":
      return pick(READING, tick, seed);
    case "comparing":
      return pick(COMPARING, tick, seed);
    case "writing":
      return pick(WRITING, tick, seed);
    case "slow":
      return pick(SLOW, tick, seed);
  }
}

/** Riga di riepilogo della timeline a ricerca conclusa. */
export function summaryPhrase(input: { sources: number; products: number; failed: number }): string {
  const { sources, products, failed } = input;
  const base = `Fiuto ha girato ${sources} ${sources === 1 ? "bancarella" : "bancarelle"} · ${products} ${
    products === 1 ? "annuncio" : "annunci"
  }`;
  return failed ? `${base} · ${failed} ${failed === 1 ? "chiusa" : "chiuse"}` : base;
}

export { SERVER_NAMES };

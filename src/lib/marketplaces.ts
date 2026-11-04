import type { MarketplaceId } from "@/lib/types";

/** Categoria del marketplace: guida l'auto-copertura e il prompt (non cambia la UI). */
export type MarketplaceTag = "generalista" | "usato" | "confronto" | "elettronica" | "moda" | "cina";

export interface MarketplaceMeta {
  id: MarketplaceId;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  description: string;
  domain: string;
  tag: MarketplaceTag;
  /**
   * Se true, quando il modello salta questo marketplace lo interrogo io con la stessa query (auto-copertura).
   * I negozi specializzati (elettronica, moda) restano false: li chiama il modello solo se pertinenti.
   */
  autoCover: boolean;
}

export const MARKETPLACES: Record<MarketplaceId, MarketplaceMeta> = {
  amazon: {
    id: "amazon",
    label: "Amazon.it",
    shortLabel: "Amazon",
    color: "#ffb000",
    textColor: "#231a00",
    description: "Nuovo, spedizioni veloci, resi facili",
    domain: "amazon.it",
    tag: "generalista",
    autoCover: true,
  },
  ebay: {
    id: "ebay",
    label: "eBay venduti (US/UK)",
    shortLabel: "eBay",
    color: "#e53238",
    textColor: "#fff5f5",
    description: "Prezzi di vendita reali su eBay US/UK",
    domain: "ebay.com",
    tag: "usato",
    autoCover: true,
  },
  aliexpress: {
    id: "aliexpress",
    label: "AliExpress",
    shortLabel: "AliExpress",
    color: "#e8381c",
    textColor: "#fff7f3",
    description: "Prezzi bassi, consegne più lunghe",
    domain: "aliexpress.com",
    tag: "generalista",
    autoCover: true,
  },
  vinted: {
    id: "vinted",
    label: "Vinted",
    shortLabel: "Vinted",
    color: "#0bb5b0",
    textColor: "#02201f",
    description: "Seconda mano, moda e accessori",
    domain: "vinted.it",
    tag: "usato",
    autoCover: true,
  },
  subito: {
    id: "subito",
    label: "Subito.it",
    shortLabel: "Subito",
    color: "#ff6a13",
    textColor: "#2b1000",
    description: "Usato locale in tutta Italia",
    domain: "subito.it",
    tag: "usato",
    autoCover: true,
  },
  "facebook-marketplace": {
    id: "facebook-marketplace",
    label: "Facebook Marketplace",
    shortLabel: "Marketplace",
    color: "#1877f2",
    textColor: "#f4f8ff",
    description: "Annunci vicini a te, usato",
    domain: "facebook.com",
    tag: "usato",
    autoCover: true,
  },
  wallapop: {
    id: "wallapop",
    label: "Wallapop",
    shortLabel: "Wallapop",
    color: "#2eb872",
    textColor: "#04210f",
    description: "Annunci tra privati in tutta Italia, usato",
    domain: "wallapop.com",
    tag: "usato",
    autoCover: true,
  },
  trovaprezzi: {
    id: "trovaprezzi",
    label: "Trovaprezzi",
    shortLabel: "Trovaprezzi",
    color: "#8e44ad",
    textColor: "#fbf5ff",
    description: "Confronto prezzi tra molti negozi online",
    domain: "trovaprezzi.it",
    tag: "confronto",
    autoCover: true,
  },
  idealo: {
    id: "idealo",
    label: "idealo",
    shortLabel: "idealo",
    color: "#2b3a67",
    textColor: "#f3f6ff",
    description: "Confronto prezzi: il negozio più economico per ogni prodotto",
    domain: "idealo.it",
    tag: "confronto",
    autoCover: true,
  },
  mediaworld: {
    id: "mediaworld",
    label: "MediaWorld",
    shortLabel: "MediaWorld",
    color: "#cc1f36",
    textColor: "#fff5f6",
    description: "Elettronica ed elettrodomestici, nuovo e ricondizionato",
    domain: "mediaworld.it",
    tag: "elettronica",
    autoCover: false,
  },
  unieuro: {
    id: "unieuro",
    label: "Unieuro",
    shortLabel: "Unieuro",
    color: "#e6007e",
    textColor: "#fff4fa",
    description: "Elettronica ed elettrodomestici nuovi",
    domain: "unieuro.it",
    tag: "elettronica",
    autoCover: false,
  },
  zalando: {
    id: "zalando",
    label: "Zalando",
    shortLabel: "Zalando",
    color: "#1c1c1c",
    textColor: "#ffffff",
    description: "Moda nuova: scarpe, abbigliamento, accessori",
    domain: "zalando.it",
    tag: "moda",
    autoCover: false,
  },
};

export const MARKETPLACE_ORDER: MarketplaceId[] = [
  "amazon",
  "ebay",
  "vinted",
  "subito",
  "wallapop",
  "facebook-marketplace",
  "aliexpress",
  "trovaprezzi",
  "idealo",
  "mediaworld",
  "unieuro",
  "zalando",
];

export const MARKETPLACE_IDS = MARKETPLACE_ORDER;

/** Link da aprire per un prodotto: per Facebook ricostruisce l'URL diretto dell'annuncio dall'id. */
export function productHref(product: {
  marketplace: MarketplaceId;
  id: string;
  url: string;
}): string {
  if (product.marketplace === "facebook-marketplace") {
    const id = /^\d{6,}$/.test(product.id)
      ? product.id
      : product.url.match(/\/marketplace\/item\/(\d+)/)?.[1];
    if (id) return `https://www.facebook.com/marketplace/item/${id}/`;
  }
  return product.url;
}

import type { MarketplaceId } from "@/lib/types";

export interface MarketplaceMeta {
  id: MarketplaceId;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  description: string;
  domain: string;
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
  },
  ebay: {
    id: "ebay",
    label: "eBay.it",
    shortLabel: "eBay",
    color: "#e53238",
    textColor: "#fff5f5",
    description: "Nuovo e usato, aste e Compralo Subito",
    domain: "ebay.it",
  },
  aliexpress: {
    id: "aliexpress",
    label: "AliExpress",
    shortLabel: "AliExpress",
    color: "#e8381c",
    textColor: "#fff7f3",
    description: "Prezzi bassi, consegne più lunghe",
    domain: "aliexpress.com",
  },
  vinted: {
    id: "vinted",
    label: "Vinted",
    shortLabel: "Vinted",
    color: "#0bb5b0",
    textColor: "#02201f",
    description: "Seconda mano, moda e accessori",
    domain: "vinted.it",
  },
  subito: {
    id: "subito",
    label: "Subito.it",
    shortLabel: "Subito",
    color: "#ff6a13",
    textColor: "#2b1000",
    description: "Usato locale in tutta Italia",
    domain: "subito.it",
  },
  "facebook-marketplace": {
    id: "facebook-marketplace",
    label: "Facebook Marketplace",
    shortLabel: "Marketplace",
    color: "#1877f2",
    textColor: "#f4f8ff",
    description: "Annunci vicini a te, usato",
    domain: "facebook.com",
  },
};

export const MARKETPLACE_ORDER: MarketplaceId[] = [
  "amazon",
  "ebay",
  "vinted",
  "subito",
  "facebook-marketplace",
  "aliexpress",
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

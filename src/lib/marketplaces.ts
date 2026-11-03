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
  "vinted",
  "subito",
  "facebook-marketplace",
  "aliexpress",
];

export const MARKETPLACE_IDS = MARKETPLACE_ORDER;

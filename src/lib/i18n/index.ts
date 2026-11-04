import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { it, type Dict } from "@/lib/i18n/it";

/**
 * i18n minimale, senza librerie: dizionari tipizzati per lingua, `t()` con fallback en -> it.
 * Sicuro lato server e client (nessuna dipendenza da React). L'hook `useT()` sta in `./client`.
 *
 * Plurali: le chiavi con suffisso `_one` / `_other` si risolvono con `vars.count` (Intl.PluralRules);
 * nel codice si usa la chiave senza suffisso.
 */

export const LANGS = ["it", "en", "es", "fr", "de"] as const;
export type Lang = (typeof LANGS)[number];
export type LangSetting = "auto" | Lang;

export const DEFAULT_LANG: Lang = "it";
export const LANG_COOKIE = "bazaar-lang";

/** Nomi nativi, mostrati nel selettore. */
export const LANG_NATIVE_NAMES: Record<Lang, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

/** Nome in inglese, usato nei prompt per il modello. */
export const LANG_ENGLISH_NAMES: Record<Lang, string> = {
  it: "Italian",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
};

export const LOCALES: Record<Lang, string> = {
  it: "it-IT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

type PluralSuffix = "_one" | "_other";
type StripPlural<K> = K extends `${infer B}${PluralSuffix}` ? B : K;
export type TKey = StripPlural<keyof Dict>;
export type TVars = Record<string, string | number>;

const DICTS: Record<Lang, Partial<Record<string, string>>> = { it, en, es, fr, de };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function isLangSetting(value: unknown): value is LangSetting {
  return value === "auto" || isLang(value);
}

/** Lingua dell'interfaccia dal valore `lang` ricevuto da fuori (API, cookie): lingue non valide -> default. */
export function coerceLang(value: unknown, fallback: Lang = DEFAULT_LANG): Lang {
  return isLang(value) ? value : fallback;
}

/**
 * Sceglie la lingua da una lista ordinata di preferenze (Accept-Language o navigator.languages).
 * Prima lingua supportata vince; se nessuna è supportata (es. giapponese) l'interfaccia è in inglese;
 * senza preferenze usa `fallback`.
 */
export function pickLang(preferences: readonly string[], fallback: Lang = DEFAULT_LANG): Lang {
  let sawAny = false;
  for (const raw of preferences) {
    const primary = raw.trim().toLowerCase().split(/[-_]/)[0];
    if (!primary || primary === "*") continue;
    sawAny = true;
    if (isLang(primary)) return primary;
  }
  return sawAny ? "en" : fallback;
}

/** Parser di Accept-Language (ordina per q). */
export function langFromAcceptLanguage(header: string | null | undefined, fallback: Lang = DEFAULT_LANG): Lang {
  if (!header) return fallback;
  const preferences = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((entry) => entry.tag);
  return pickLang(preferences, fallback);
}

const STOPWORDS: Record<Lang, string> = {
  it: "il lo gli una uno che per con non sono mi ti ci ma se cerco voglio vorrei volessi vorrebbe anche sotto sopra quanto dove costa quale quali bici usato usata nuovo nuova economico economica più meno dei delle nel nella sul alla degli ok e è",
  en: "the and for with want need looking under over used cheap best which what how does are you your me my find any some from than less more that this is it to of on",
  es: "el los las una que para con por quiero busco necesito barato barata más como donde dónde cuál cuáles qué tengo algo sobre menos muy y es en un del al segunda mano",
  fr: "le les des une du que pour avec je veux cherche besoin pas cher chère moins plus est dans sur où quel quels quelle comment je j' mon ma mes d'occasion et un",
  de: "der die das und ein eine einen ich möchte suche brauche für mit nicht ist auf gebraucht günstig billig welche was wie wo unter über mein meine zum zur bitte",
};
const STOPWORD_SETS = Object.fromEntries(
  (Object.keys(STOPWORDS) as Lang[]).map((lang) => [lang, new Set(STOPWORDS[lang].split(" "))]),
) as Record<Lang, Set<string>>;

/**
 * Stima la lingua di un messaggio tra quelle supportate (stopword). `null` se il testo è troppo corto o ambiguo
 * (o in un'altra lingua): in quel caso decide il modello.
 */
export function detectMessageLang(text: string): Lang | null {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length < 3) return null;
  const scores = (Object.keys(STOPWORD_SETS) as Lang[])
    .map((lang) => ({ lang, score: words.filter((word) => STOPWORD_SETS[lang].has(word)).length }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  return best.score >= 2 && best.score >= second.score + 2 ? best.lang : null;
}

function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

function lookup(lang: Lang, key: string, count?: number): string | undefined {
  const dict = DICTS[lang];
  if (count !== undefined) {
    const category = new Intl.PluralRules(LOCALES[lang]).select(count) === "one" ? "one" : "other";
    return dict[`${key}_${category}`] ?? dict[`${key}_other`] ?? dict[key];
  }
  return dict[key];
}

/** Traduzione con fallback: lingua richiesta -> inglese -> italiano -> la chiave stessa. */
export function t(lang: Lang, key: TKey, vars?: TVars): string {
  const count = typeof vars?.count === "number" ? vars.count : undefined;
  const text = lookup(lang, key, count) ?? lookup("en", key, count) ?? lookup("it", key, count) ?? key;
  return interpolate(text, vars);
}

export type Translator = (key: TKey, vars?: TVars) => string;

export function translator(lang: Lang): Translator {
  return (key, vars) => t(lang, key, vars);
}

export { type Dict };

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_LANG,
  LANG_COOKIE,
  isLang,
  pickLang,
  t as translate,
  type Lang,
  type TKey,
  type TVars,
} from "@/lib/i18n";
import { BASE_PATH } from "@/lib/base-path";

interface I18nValue {
  lang: Lang;
  t: (key: TKey, vars?: TVars) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: DEFAULT_LANG,
  t: (key, vars) => translate(DEFAULT_LANG, key, vars),
});

/** Lingua scelta dal visitatore (cookie) o, in mancanza, dalle preferenze del browser. */
export function detectBrowserLang(fallback: Lang = DEFAULT_LANG, useCookie = true): Lang {
  try {
    const match = useCookie ? document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]+)`)) : null;
    if (match && isLang(match[1])) return match[1];
  } catch {
    // cookie non disponibili
  }
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  return pickLang(preferences.filter(Boolean), fallback);
}

/** Salva (o cancella, con `null`) la preferenza di lingua in un cookie leggibile anche dal server. */
export function persistLangCookie(lang: Lang | null): void {
  try {
    const path = BASE_PATH || "/";
    document.cookie = lang
      ? `${LANG_COOKIE}=${lang}; path=${path}; max-age=31536000; samesite=lax`
      : `${LANG_COOKIE}=; path=${path}; max-age=0; samesite=lax`;
  } catch {
    // ignora
  }
}

/**
 * Fornisce lingua e `t()` ai client component e imposta `<html lang>`.
 * Con `lang` esplicito la lingua è quella; senza, parte da `initial` e passa a quella del browser dopo il mount.
 */
export function I18nProvider({
  lang,
  initial = DEFAULT_LANG,
  children,
}: {
  lang?: Lang;
  initial?: Lang;
  children: ReactNode;
}) {
  const [detected, setDetected] = useState<Lang>(initial);
  useEffect(() => {
    if (!lang) setDetected(detectBrowserLang(initial));
  }, [lang, initial]);

  const active = lang ?? detected;
  useEffect(() => {
    document.documentElement.lang = active;
  }, [active]);

  const value = useMemo<I18nValue>(
    () => ({ lang: active, t: (key, vars) => translate(active, key, vars) }),
    [active],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  return useContext(I18nContext);
}

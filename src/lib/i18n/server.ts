import { cookies, headers } from "next/headers";

import { DEFAULT_LANG, LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from "@/lib/i18n";

/**
 * Lingua della richiesta corrente: cookie scelto dall'utente, poi Accept-Language (it/en/es/fr/de),
 * default italiano. Dinamica: da chiamare dentro un confine <Suspense>.
 */
export async function requestLang(): Promise<Lang> {
  const stored = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(stored)) return stored;
  return langFromAcceptLanguage((await headers()).get("accept-language"), DEFAULT_LANG);
}

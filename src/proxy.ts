import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_PREFIX, isAuthDisabled } from "@/lib/auth/config";

/**
 * Controllo ottimistico (solo presenza del cookie di sessione) per evitare lavoro inutile.
 * L'autorizzazione vera avviene sul server con auth.api.getSession() in pagina e route API.
 *
 * Con `basePath` Next toglie il prefisso da `nextUrl.pathname` e dal `matcher`: qui i path sono
 * interni all'app ("/api/chat"), e `url.pathname = "/login"` / NextResponse.redirect lo riaggiungono.
 */
export function proxy(request: NextRequest) {
  if (isAuthDisabled()) return NextResponse.next();
  if (getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX })) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Accedi per continuare." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" && !search ? "" : `?callbackURL=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/api/chat", "/api/models", "/api/status"],
};

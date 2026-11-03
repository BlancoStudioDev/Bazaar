import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_PREFIX, isAuthDisabled } from "@/lib/auth/config";
import { isValidShareToken } from "@/lib/share/snapshot";
import { getActiveShare } from "@/lib/share/store";

/**
 * Controllo ottimistico (solo presenza del cookie di sessione) per evitare lavoro inutile.
 * L'autorizzazione vera avviene sul server con auth.api.getSession() in pagina e route API.
 *
 * Con `basePath` Next toglie il prefisso da `nextUrl.pathname` e dal `matcher`: qui i path sono
 * interni all'app ("/api/chat"), e `url.pathname = "/login"` / NextResponse.redirect lo riaggiungono.
 */
export function proxy(request: NextRequest) {
  // Pagina pubblica delle chat condivise: nessun login. Solo /s/<token>, mai altro.
  if (request.nextUrl.pathname.startsWith("/s/")) return sharedPage(request);

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

/**
 * Pubblico: solo `/s/<token>` (32 caratteri base64url). Token malformato o inesistente/revocato
 * -> 404 vero (la pagina non può cambiare lo status dopo che lo streaming è partito) senza
 * mai esporre dati. Header: niente referrer, niente indicizzazione, niente cache condivisa.
 */
function sharedPage(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const token = parts.length === 2 ? parts[1] : "";
  const known = isValidShareToken(token) && getActiveShare(token) !== null;
  const response = known
    ? NextResponse.next()
    : NextResponse.rewrite(new URL("/s/gone/none/404", request.url), { status: 404 });
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// /api/share (POST/DELETE) richiede la sessione; /s/* è pubblico ma passa di qui per gli header.
export const config = {
  matcher: ["/", "/api/chat", "/api/models", "/api/status", "/api/share", "/s/:path*"],
};

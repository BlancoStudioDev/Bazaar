import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAuthDisabled } from "@/lib/auth/config";

/**
 * Controllo ottimistico (solo presenza del cookie di sessione) per evitare lavoro inutile.
 * L'autorizzazione vera avviene sul server con auth.api.getSession() in pagina e route API.
 */
export function proxy(request: NextRequest) {
  if (isAuthDisabled()) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

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

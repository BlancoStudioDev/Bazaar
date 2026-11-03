import { getAuth } from "@/lib/auth/auth";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Next rimuove il basePath da `request.url` nei route handler, ma Better Auth (basePath
 * `${APP_BASE_PATH}/api/auth`) si aspetta il path pubblico completo: lo ripristiniamo qui.
 */
function withPublicPath(request: Request): Request {
  if (!BASE_PATH) return request;
  const url = new URL(request.url);
  if (url.pathname === BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`)) return request;
  url.pathname = `${BASE_PATH}${url.pathname}`;
  return new Request(url, request);
}

async function handle(request: Request) {
  const auth = getAuth();
  if (!auth) {
    return Response.json({ error: "Autenticazione disabilitata in questo ambiente." }, { status: 404 });
  }
  return auth.handler(withPublicPath(request));
}

export { handle as GET, handle as POST };

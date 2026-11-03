/**
 * Sotto-percorso pubblico dell'app (es. "/bazaar" servita su https://blancostudio.dev/bazaar).
 * Non è un segreto. Sorgente: env `APP_BASE_PATH` letta in next.config.ts (build time), che la
 * espone anche come `NEXT_PUBLIC_BASE_PATH` (inlined nel bundle client). Vuota = app alla radice.
 *
 * <Link>, redirect() e next/navigation aggiungono il basePath da soli: NON usare questi helper
 * per quelli. Servono per fetch(), window.location, callbackURL di Better Auth e simili.
 */
export const BASE_PATH: string = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** Prefissa un path interno ("/api/chat") con il basePath. */
export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

/** URL di una route API dell'app, es. apiPath("/api/status"). */
export function apiPath(path: string): string {
  return withBasePath(path);
}

/** Rimuove il basePath da un path (se presente), restituendo un path interno all'app. */
export function stripBasePath(path: string): string {
  if (!BASE_PATH) return path;
  if (path === BASE_PATH) return "/";
  if (path.startsWith(`${BASE_PATH}/`) || path.startsWith(`${BASE_PATH}?`) || path.startsWith(`${BASE_PATH}#`)) {
    const rest = path.slice(BASE_PATH.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return path;
}

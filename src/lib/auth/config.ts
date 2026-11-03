/**
 * Configurazione dell'autenticazione (solo server). Nessun segreto in NEXT_PUBLIC_* (l'unica è
 * NEXT_PUBLIC_BASE_PATH, non segreta).
 * La validazione è lazy (alla prima chiamata, e all'avvio tramite instrumentation.ts)
 * così `next build` non richiede i segreti.
 */

import { BASE_PATH } from "@/lib/base-path";

export const DEFAULT_ISSUER = "https://auth.onionrings.dev/api/auth";
export const LOCAL_USER_ID = "local";
/** Prefisso cookie Better Auth, univoco per non collidere con altre app sullo stesso dominio. */
export const COOKIE_PREFIX = "bazaar";

export type AuthConfig =
  | { mode: "disabled" }
  | {
      mode: "enabled";
      /** Solo origine pubblica (es. https://blancostudio.dev), senza basePath. */
      baseURL: string;
      /** Sotto-percorso dell'app (APP_BASE_PATH, es. "/bazaar"); "" = radice. */
      basePath: string;
      secret: string;
      issuer: string;
      clientId: string;
      clientSecret: string;
      dbPath: string;
      allowedEmails: string[];
      secureCookies: boolean;
    };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Controllo economico (senza throw) usato da proxy e route. */
export function isAuthDisabled(): boolean {
  if (isProduction()) return false;
  return !clean(process.env.ONIONRINGS_CLIENT_ID) && !clean(process.env.ONIONRINGS_CLIENT_SECRET);
}

export function parseAllowedEmails(raw: string | undefined): string[] {
  return clean(raw)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(
  allowed: string[],
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
): boolean {
  if (allowed.length === 0) return true;
  if (!email || emailVerified !== true) return false;
  return allowed.includes(email.trim().toLowerCase());
}

let cached: AuthConfig | null = null;

export function getAuthConfig(): AuthConfig {
  if (cached) return cached;
  const prod = isProduction();

  if (isAuthDisabled()) {
    console.warn(
      "[auth] ONIONRINGS_CLIENT_ID/SECRET non impostati: autenticazione DISABILITATA (solo sviluppo). Tutte le richieste girano come utente locale «local».",
    );
    cached = { mode: "disabled" };
    return cached;
  }

  // BETTER_AUTH_URL = origine pubblica (https://blancostudio.dev); APP_BASE_PATH (/bazaar) è separato.
  const baseURL = clean(process.env.BETTER_AUTH_URL).replace(/\/+$/, "");
  const secret = clean(process.env.BETTER_AUTH_SECRET);
  const issuer = (clean(process.env.ONIONRINGS_ISSUER) || DEFAULT_ISSUER).replace(/\/+$/, "");
  const clientId = clean(process.env.ONIONRINGS_CLIENT_ID);
  const clientSecret = clean(process.env.ONIONRINGS_CLIENT_SECRET);

  const missing: string[] = [];
  if (!baseURL) missing.push("BETTER_AUTH_URL");
  if (!secret) missing.push("BETTER_AUTH_SECRET");
  if (!clientId) missing.push("ONIONRINGS_CLIENT_ID");
  if (!clientSecret) missing.push("ONIONRINGS_CLIENT_SECRET");
  if (missing.length) {
    throw new Error(
      `[auth] Configurazione mancante: ${missing.join(", ")}. ` +
        (prod
          ? "In produzione le credenziali OnionRings sono obbligatorie."
          : "Imposta tutte le variabili OnionRings oppure nessuna (modalità locale senza login)."),
    );
  }

  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    throw new Error("[auth] BETTER_AUTH_URL non è un URL valido (es. https://blancostudio.dev).");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "[auth] BETTER_AUTH_URL deve essere solo l'origine pubblica (es. https://blancostudio.dev), senza path: il sotto-percorso (/bazaar) va in APP_BASE_PATH.",
    );
  }
  if (prod && url.protocol !== "https:" && !LOOPBACK.has(url.hostname)) {
    throw new Error("[auth] In produzione BETTER_AUTH_URL deve usare HTTPS.");
  }
  if (prod && secret.length < 32) {
    throw new Error("[auth] BETTER_AUTH_SECRET deve avere almeno 32 caratteri (es. `openssl rand -base64 32`).");
  }
  try {
    const iss = new URL(issuer);
    if (iss.protocol !== "https:" && !LOOPBACK.has(iss.hostname)) {
      throw new Error("insecure");
    }
  } catch {
    throw new Error("[auth] ONIONRINGS_ISSUER non valido: serve un URL HTTPS (HTTP solo su loopback).");
  }

  cached = {
    mode: "enabled",
    baseURL: url.origin,
    basePath: BASE_PATH,
    secret,
    issuer,
    clientId,
    clientSecret,
    dbPath: clean(process.env.AUTH_DB_PATH) || "./data/auth.sqlite",
    allowedEmails: parseAllowedEmails(process.env.ALLOWED_EMAILS),
    secureCookies: url.protocol === "https:",
  };
  return cached;
}

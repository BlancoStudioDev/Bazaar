import fs from "node:fs";
import path from "node:path";

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import Database from "better-sqlite3";

import { COOKIE_PREFIX, getAuthConfig, isEmailAllowed } from "./config";

function createAuth() {
  const config = getAuthConfig();
  if (config.mode !== "enabled") return null;

  const dbFile = path.resolve(config.dbPath);
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const denied = () =>
    new APIError("FORBIDDEN", {
      message: "Account non autorizzato.",
      code: "not_allowed",
    });

  return betterAuth({
    appName: "Bazaar",
    // baseURL = solo origine pubblica (https://blancostudio.dev); il sotto-percorso sta in basePath.
    // Callback OAuth risultante: {origine}{APP_BASE_PATH}/api/auth/callback/onionrings
    baseURL: config.baseURL,
    basePath: `${config.basePath}/api/auth`,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: db,
    // Identità = issuer + sub (account OAuth). Nessun linking implicito per email.
    account: { accountLinking: { enabled: false } },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    advanced: {
      useSecureCookies: config.secureCookies,
      // Prefisso univoco e path limitato al basePath: niente collisioni con altri siti su blancostudio.dev.
      cookiePrefix: COOKIE_PREFIX,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.secureCookies,
        path: config.basePath || "/",
      },
    },
    onAPIError: { errorURL: `${config.baseURL}${config.basePath}/login` },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isEmailAllowed(config.allowedEmails, user.email, user.emailVerified)) throw denied();
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const row = db
              .prepare('SELECT email, emailVerified FROM "user" WHERE id = ?')
              .get(session.userId) as { email: string | null; emailVerified: number | boolean } | undefined;
            if (!row || !isEmailAllowed(config.allowedEmails, row.email, Boolean(row.emailVerified))) {
              throw denied();
            }
          },
        },
      },
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "onionrings",
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            discoveryUrl: `${config.issuer}/.well-known/openid-configuration`,
            tokenEndpointAuth: { method: "client_secret_basic" },
            requireIdTokenVerification: true,
            pkce: true,
            scopes: ["openid", "profile", "email"],
            disableProviderLogout: true,
          },
        ],
      }),
    ],
  });
}

type Auth = NonNullable<ReturnType<typeof createAuth>>;

const g = globalThis as unknown as { __bazaarAuth?: Auth | null };

/** Istanza Better Auth (singleton, lazy). `null` in modalità auth disabilitata. */
export function getAuth(): Auth | null {
  if (g.__bazaarAuth === undefined) g.__bazaarAuth = createAuth();
  return g.__bazaarAuth;
}

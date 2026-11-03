import { getAuth } from "./auth";
import { getAuthConfig, isEmailAllowed, LOCAL_USER_ID } from "./config";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  /** false in modalità sviluppo senza credenziali (utente locale fittizio). */
  authEnabled: boolean;
}

export const LOCAL_USER: AppUser = {
  id: LOCAL_USER_ID,
  name: "Locale",
  email: "",
  authEnabled: false,
};

export type SessionResult =
  | { user: AppUser; denied?: false }
  | { user: null; denied: boolean };

/** Verifica la sessione sul server (cookie + database). */
export async function resolveSession(headers: Headers): Promise<SessionResult> {
  const config = getAuthConfig();
  if (config.mode === "disabled") return { user: LOCAL_USER };

  const auth = getAuth();
  if (!auth) return { user: null, denied: false };

  const session = await auth.api.getSession({ headers });
  if (!session?.user) return { user: null, denied: false };

  const { user } = session;
  if (!isEmailAllowed(config.allowedEmails, user.email, user.emailVerified)) {
    return { user: null, denied: true };
  }
  return {
    user: { id: user.id, name: user.name || user.email || "Utente", email: user.email || "", authEnabled: true },
  };
}

/** Per le route API: restituisce l'utente oppure una risposta 401 JSON. */
export async function requireUser(request: Request): Promise<{ user: AppUser } | { response: Response }> {
  let result: SessionResult;
  try {
    result = await resolveSession(request.headers);
  } catch (error) {
    console.error("[auth] errore nella verifica della sessione:", error instanceof Error ? error.name : "unknown");
    return {
      response: Response.json(
        { error: "Servizio di autenticazione non disponibile." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  if (!result.user) {
    return {
      response: Response.json(
        { error: result.denied ? "Account non autorizzato." : "Accedi per continuare." },
        { status: result.denied ? 403 : 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { user: result.user };
}

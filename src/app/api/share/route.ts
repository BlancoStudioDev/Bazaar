import { BASE_PATH } from "@/lib/base-path";
import { requireUser } from "@/lib/auth/session";
import { buildSnapshot, isValidShareToken } from "@/lib/share/snapshot";
import { countRecentShares, createShare, revokeShare, sharesPerHour } from "@/lib/share/store";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function fail(error: string, status: number, extra?: Record<string, string>) {
  return Response.json({ error }, { status, headers: { ...NO_STORE, ...extra } });
}

/** Origine pubblica: BETTER_AUTH_URL; in sviluppo senza auth si ripiega sull'origine della richiesta. */
function publicOrigin(request: Request): string {
  const configured = (process.env.BETTER_AUTH_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // ignora e usa il fallback
    }
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return fail("La chat è troppo grande per essere condivisa.", 413);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail("La chat è troppo grande per essere condivisa.", 413);
    body = JSON.parse(text);
  } catch {
    return fail("Richiesta non valida.", 400);
  }

  const snapshot = buildSnapshot(body);
  if (!snapshot) return fail("Non c'è ancora nulla da condividere: aspetta una risposta di Bazaar.", 422);

  const limit = sharesPerHour();
  const recent = countRecentShares(user.id);
  if (recent.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil(((recent.oldest ?? Date.now()) + 60 * 60 * 1000 - Date.now()) / 1000));
    const minutes = Math.ceil(retryAfter / 60);
    return fail(
      `Hai creato ${limit} link nell'ultima ora. Riprova tra circa ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`,
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  const { token, createdAt } = createShare(user.id, snapshot);
  const url = `${publicOrigin(request)}${BASE_PATH}/s/${token}`;
  return Response.json({ token, url, createdAt }, { status: 201, headers: NO_STORE });
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;

  const token = new URL(request.url).searchParams.get("token");
  if (!isValidShareToken(token)) return fail("Link non valido.", 400);
  // 404 se non esiste o non è dell'utente: non distingue i due casi.
  if (!revokeShare(token, auth.user.id)) return fail("Condivisione non trovata.", 404);
  return Response.json({ ok: true }, { headers: NO_STORE });
}

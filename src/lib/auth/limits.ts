/**
 * Limiti per utente (in memoria, per processo): richieste/ora, concorrenza per utente
 * e tetto globale di concorrenza per proteggere i server MCP condivisi.
 */

function intEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const HOUR_MS = 60 * 60 * 1000;
/** Rete di sicurezza: uno slot non rilasciato scade comunque (maxDuration chat = 300s). */
const SLOT_TTL_MS = 6 * 60 * 1000;

interface LimiterState {
  hits: Map<string, number[]>;
  active: Map<string, number>;
  global: number;
}

const g = globalThis as unknown as { __bazaarLimits?: LimiterState };
const state: LimiterState = (g.__bazaarLimits ??= { hits: new Map(), active: new Map(), global: 0 });

export type SlotResult =
  | { ok: true; release: () => void }
  | { ok: false; status: 429; retryAfter: number; message: string };

function prune(now: number) {
  for (const [key, list] of state.hits) {
    const fresh = list.filter((t) => now - t < HOUR_MS);
    if (fresh.length) state.hits.set(key, fresh);
    else state.hits.delete(key);
  }
}

export function acquireChatSlot(userId: string): SlotResult {
  const now = Date.now();
  const perHour = intEnv("CHAT_RATE_PER_HOUR", 30);
  const perUser = intEnv("CHAT_MAX_CONCURRENT_PER_USER", 2);
  const globalMax = intEnv("CHAT_MAX_CONCURRENT_GLOBAL", 6);

  if (state.hits.size > 500) prune(now);

  const userActive = state.active.get(userId) ?? 0;
  if (userActive >= perUser) {
    return {
      ok: false,
      status: 429,
      retryAfter: 10,
      message: `Hai già ${userActive} ricerche in corso. Attendi che finiscano e riprova.`,
    };
  }
  if (state.global >= globalMax) {
    return {
      ok: false,
      status: 429,
      retryAfter: 15,
      message: "Bazaar è molto richiesto in questo momento. Riprova tra qualche secondo.",
    };
  }

  const recent = (state.hits.get(userId) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= perHour) {
    const retryAfter = Math.max(1, Math.ceil((recent[0] + HOUR_MS - now) / 1000));
    const minutes = Math.ceil(retryAfter / 60);
    return {
      ok: false,
      status: 429,
      retryAfter,
      message: `Hai raggiunto il limite di ${perHour} ricerche all'ora. Riprova tra circa ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`,
    };
  }

  recent.push(now);
  state.hits.set(userId, recent);
  state.active.set(userId, userActive + 1);
  state.global += 1;

  let released = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const release = () => {
    if (released) return;
    released = true;
    if (timer) clearTimeout(timer);
    const left = (state.active.get(userId) ?? 1) - 1;
    if (left > 0) state.active.set(userId, left);
    else state.active.delete(userId);
    state.global = Math.max(0, state.global - 1);
  };
  timer = setTimeout(release, SLOT_TTL_MS);
  timer.unref?.();
  return { ok: true, release };
}

export function rateLimitResponse(result: Extract<SlotResult, { ok: false }>): Response {
  return Response.json(
    { error: result.message },
    {
      status: result.status,
      headers: { "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" },
    },
  );
}

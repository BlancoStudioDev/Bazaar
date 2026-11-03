import type { FreeModel, ModelMetrics, ModelRegistry } from "@/lib/types";
import {
  getActiveDirectProviders,
  getDirectModels,
  hasOpenRouterKey,
  isCoolingDown,
  providerModelName,
} from "@/lib/openrouter/providers";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 18_000;
const MAX_FREE_ATTEMPTS = 6;

export class OpenRouterError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.code = code;
  }
}

export function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new OpenRouterError(
      "OPENROUTER_API_KEY non configurata. Aggiungila in .env.local e riavvia il server.",
      401,
      "missing_key",
    );
  }
  return key;
}

export function openRouterHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_NAME || "Bazaar",
    ...extra,
  };
}

export function maskKey(key: string): string {
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 10)}••••${key.slice(-4)}`;
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeout = REQUEST_TIMEOUT_MS): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: openRouterHeaders(init.headers as Record<string, string> | undefined),
    signal: init.signal || AbortSignal.timeout(timeout),
    cache: "no-store",
  });
  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const record = payload as { error?: { message?: string; code?: number | string } } | null;
    const message =
      record?.error?.message ||
      `OpenRouter ha risposto ${response.status}${raw ? `: ${raw.slice(0, 200)}` : ""}`;
    throw new OpenRouterError(message, response.status, String(record?.error?.code ?? ""));
  }
  return payload as T;
}

interface RawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: { output_modalities?: string[]; modality?: string };
  pricing?: { prompt?: string | number; completion?: string | number };
  supported_parameters?: string[];
}

interface RawModelsResponse {
  data?: RawModel[];
}

interface RawEndpoint {
  provider_name?: string;
  status?: number;
  uptime_last_1d?: number;
  uptime_last_30m?: number;
  latency_last_30m?: { p50?: number; p75?: number };
  throughput_last_30m?: { p50?: number };
  supported_parameters?: string[];
}

interface RawEndpointsResponse {
  data?: { endpoints?: RawEndpoint[] };
}

interface ModelCache {
  registry: ModelRegistry | null;
  fetchedAt: number;
  inflight: Promise<ModelRegistry> | null;
}

const globalForModels = globalThis as unknown as {
  __bazaarModelCache?: ModelCache;
};

function cache(): ModelCache {
  if (!globalForModels.__bazaarModelCache) {
    globalForModels.__bazaarModelCache = { registry: null, fetchedAt: 0, inflight: null };
  }
  return globalForModels.__bazaarModelCache;
}

function isZeroPrice(value: string | number | undefined): boolean {
  if (value === undefined) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed === 0;
}

function isFreeModel(model: RawModel): boolean {
  if (!isZeroPrice(model.pricing?.prompt) || !isZeroPrice(model.pricing?.completion)) return false;
  const output = model.architecture?.output_modalities;
  if (output && !output.includes("text")) return false;
  return true;
}

function supportsTools(model: RawModel): boolean {
  return Boolean(model.supported_parameters?.includes("tools"));
}

interface CatalogPrice {
  /** USD per 1M token in ingresso. */
  prompt: number;
  /** USD per 1M token in uscita. */
  completion: number;
}

const globalForPrices = globalThis as unknown as { __bazaarPrices?: Map<string, CatalogPrice> };

function priceMap(): Map<string, CatalogPrice> {
  if (!globalForPrices.__bazaarPrices) globalForPrices.__bazaarPrices = new Map();
  return globalForPrices.__bazaarPrices;
}

function catalogPrice(model: RawModel): CatalogPrice | null {
  const prompt = Number(model.pricing?.prompt);
  const completion = Number(model.pricing?.completion);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  return { prompt: prompt * 1e6, completion: completion * 1e6 };
}

/** Costo stimato per 1M token: l'agente è dominato dal contesto in ingresso, quindi peso 3:1. */
function blendedPrice(price: CatalogPrice): number {
  return (price.prompt * 3 + price.completion) / 4;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(value < 0.1 ? 3 : 2).replace(".", ",")}`;
}

function paidLabels(price: CatalogPrice | null): { pricePerMillion?: number; pricingNote: string } {
  if (!price) {
    return { pricingNote: "Modello a pagamento (prezzo non disponibile nel catalogo)." };
  }
  return {
    pricePerMillion: blendedPrice(price),
    pricingNote: `A pagamento: ~${formatUsd(blendedPrice(price))} per 1M token (ingresso ${formatUsd(price.prompt)} · uscita ${formatUsd(price.completion)}).`,
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function extractParams(id: string, name: string): { total: number | null; active: number | null } {
  const source = `${id} ${name}`.toLowerCase();
  const activeMatch = source.match(/a(\d+(?:\.\d+)?)b\b/);
  const matches = Array.from(source.matchAll(/(\d+(?:\.\d+)?)\s*b\b/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0.5);
  const total = matches.length ? Math.max(...matches) : null;
  const active = activeMatch ? Number(activeMatch[1]) : null;
  return { total, active: active ?? total };
}

const FAMILY_PRIORS: Array<[RegExp, number]> = [
  [/deepseek/i, 0.84],
  [/qwen/i, 0.82],
  [/glm/i, 0.79],
  [/llama/i, 0.74],
  [/mistral|mixtral/i, 0.74],
  [/gemma/i, 0.69],
  [/gpt-oss/i, 0.73],
  [/phi/i, 0.63],
  [/xingchen|telechat/i, 0.62],
  [/gemini|claude|gpt-4|gpt-5/i, 0.86],
];

function intelligencePrior(id: string, name: string): number {
  const family = FAMILY_PRIORS.find(([pattern]) => pattern.test(`${id} ${name}`))?.[1] ?? 0.56;
  const { total } = extractParams(id, name);
  const sizeScore = total ? clamp((Math.log10(total) - 1) / 2.2) : 0.45;
  return clamp(family * 0.7 + sizeScore * 0.3);
}

function speedPrior(id: string, name: string): number {
  const { active } = extractParams(id, name);
  if (!active) return 0.55;
  return clamp(1 - (Math.log10(active) - 0.3) / 2.1, 0.15, 0.98);
}

function scoreModel(
  id: string,
  name: string,
  metrics: ModelMetrics,
  isRouter = false,
): FreeModel["scores"] {
  if (isRouter) {
    return { intelligence: 55, speed: 60, reliability: 50, overall: 55 };
  }
  const intelligence = Math.round(intelligencePrior(id, name) * 100);
  const speed = Math.round(
    clamp(
      0.55 * speedPrior(id, name) +
        0.25 * (metrics.latencyMs ? clamp(1 - (metrics.latencyMs - 500) / 9000) : 0.55) +
        0.2 * (metrics.throughput ? clamp(metrics.throughput / 90) : 0.55),
    ) * 100,
  );
  const reliability = Math.round(clamp((metrics.uptime ?? 80) / 100) * 100);
  const overall = Math.round(intelligence * 0.5 + speed * 0.35 + reliability * 0.15);
  return { intelligence, speed, reliability, overall };
}

function reasonFor(model: Omit<FreeModel, "reason">): string {
  const parts = [`qualità ${model.scores.intelligence}/100`];
  if (model.metrics.latencyMs) {
    parts.push(`latenza ${(model.metrics.latencyMs / 1000).toFixed(1)} s`);
  }
  if (model.metrics.throughput) {
    parts.push(`${Math.round(model.metrics.throughput)} tok/s`);
  }
  if (model.metrics.uptime != null) {
    parts.push(`uptime ${Math.round(model.metrics.uptime)}%`);
  }
  return parts.join(" · ");
}

async function fetchEndpoints(modelId: string): Promise<{
  metrics: ModelMetrics;
  provider: string;
  supportedTools: boolean;
}> {
  try {
    const payload = await fetchJson<RawEndpointsResponse>(
      `${OPENROUTER_BASE}/models/${modelId}/endpoints`,
      {},
      10_000,
    );
    const endpoints = (payload.data?.endpoints || []).filter((endpoint) => endpoint.status !== 1);
    const best = endpoints
      .slice()
      .sort((a, b) => {
        const uptime = (b.uptime_last_1d ?? 0) - (a.uptime_last_1d ?? 0);
        if (Math.abs(uptime) > 2) return uptime;
        return (a.latency_last_30m?.p50 ?? 99_999) - (b.latency_last_30m?.p50 ?? 99_999);
      })[0];

    return {
      metrics: {
        latencyMs: best?.latency_last_30m?.p50 ?? null,
        throughput: best?.throughput_last_30m?.p50 ?? null,
        uptime: best?.uptime_last_1d ?? best?.uptime_last_30m ?? null,
      },
      provider: best?.provider_name || modelId.split("/")[0],
      supportedTools: endpoints.some((endpoint) =>
        endpoint.supported_parameters?.includes("tools"),
      ),
    };
  } catch {
    return {
      metrics: { latencyMs: null, throughput: null, uptime: null },
      provider: modelId.split("/")[0],
      supportedTools: true,
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function fallbackRegistry(note: string): ModelRegistry {
  const id = "xingchen-agi/xing4.0-29b-a4b:free";
  const name = "XingChen: Xing4.0 29B A4B (free)";
  const metrics: ModelMetrics = { latencyMs: 1424, throughput: 49, uptime: 98.9 };
  const scores = scoreModel(id, name, metrics);
  const model: FreeModel = {
    id,
    name,
    provider: "Phala",
    contextLength: 262_144,
    metrics,
    scores,
    reason: reasonFor({ id, name, provider: "Phala", contextLength: 262_144, metrics, scores }),
  };
  const router = makeRouterModel();
  return {
    selected: model,
    models: [model],
    routerModel: router,
    fetchedAt: Date.now(),
    source: "fallback",
    note,
  };
}

function makeRouterModel(raw?: RawModel | null): FreeModel {
  const metrics: ModelMetrics = { latencyMs: null, throughput: null, uptime: null };
  return {
    id: "openrouter/free",
    name: raw?.name || "Free Models Router",
    provider: "OpenRouter",
    contextLength: raw?.context_length || 200_000,
    metrics,
    scores: scoreModel("openrouter/free", "Free Models Router", metrics, true),
    reason: "OpenRouter sceglie da solo un modello gratuito disponibile.",
    isRouter: true,
  };
}

const CHEAP_FAMILY = /gpt-oss|qwen|deepseek|gemini.*flash|llama|glm|mistral|gemma/i;
const CHEAP_EXCLUDE = /:batch|:extended|:free|:thinking|^~|-vl\b|vision|ocr|embed|image|audio|guard|safety|moderation/i;
const CHEAP_MIN_QUALITY = 68;
const CHEAP_MIN_CONTEXT = 32_000;
const CHEAP_TIER_SIZE = 3;

function buildCheapModel(raw: RawModel): FreeModel {
  const name = raw.name || raw.id;
  const price = catalogPrice(raw);
  const metrics: ModelMetrics = { latencyMs: null, throughput: null, uptime: null };
  const intelligence = Math.round(intelligencePrior(raw.id, name) * 100);
  const speed = Math.round(speedPrior(raw.id, name) * 100);
  const labels = paidLabels(price);
  return {
    id: raw.id,
    name,
    provider: "OpenRouter · a pagamento",
    contextLength: raw.context_length || 0,
    description: raw.description,
    metrics,
    scores: {
      intelligence,
      speed,
      reliability: 85,
      overall: Math.round(intelligence * 0.5 + speed * 0.35 + 85 * 0.15),
    },
    reason: labels.pricePerMillion != null ? `A pagamento, ~${formatUsd(labels.pricePerMillion)} / 1M token.` : "A pagamento.",
    isPaid: true,
    ...labels,
  };
}

/**
 * Tier economico: OPENROUTER_CHEAP_MODELS (lista di id) oppure, di default, i modelli
 * a pagamento con tool support più economici tra le famiglie note, scartando quelli
 * sotto una soglia di qualità/contesto.
 */
function buildCheapTier(all: RawModel[]): FreeModel[] {
  const configured = (process.env.OPENROUTER_CHEAP_MODELS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (configured.length) {
    return configured.map((id) => {
      const raw = all.find((model) => model.id === id);
      return buildCheapModel(raw || { id, name: id.split("/")[1] || id });
    });
  }
  return all
    .filter((model) => {
      if (!supportsTools(model) || CHEAP_EXCLUDE.test(model.id)) return false;
      if (model.architecture?.output_modalities && !model.architecture.output_modalities.includes("text")) {
        return false;
      }
      const price = catalogPrice(model);
      if (!price || price.prompt <= 0 || price.completion <= 0) return false;
      if (!CHEAP_FAMILY.test(`${model.id} ${model.name || ""}`)) return false;
      if ((model.context_length || 0) < CHEAP_MIN_CONTEXT) return false;
      return Math.round(intelligencePrior(model.id, model.name || model.id) * 100) >= CHEAP_MIN_QUALITY;
    })
    .sort((a, b) => blendedPrice(catalogPrice(a)!) - blendedPrice(catalogPrice(b)!))
    .slice(0, CHEAP_TIER_SIZE)
    .map(buildCheapModel);
}

async function buildRegistry(): Promise<ModelRegistry> {
  let payload: RawModelsResponse;
  try {
    payload = await fetchJson<RawModelsResponse>(`${OPENROUTER_BASE}/models`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fallbackRegistry(`Impossibile leggere il catalogo OpenRouter: ${message}`);
  }

  const all = payload.data || [];
  const prices = priceMap();
  for (const model of all) {
    const price = catalogPrice(model);
    if (price) prices.set(model.id, price);
  }
  const cheapModels = buildCheapTier(all);
  const routerRaw = all.find((model) => model.id === "openrouter/free");
  const candidates = all.filter(
    (model) => model.id !== "openrouter/free" && isFreeModel(model) && supportsTools(model),
  );

  if (!candidates.length) {
    return {
      ...fallbackRegistry(
        "OpenRouter non espone modelli gratuiti compatibili con i tool (spesso per le impostazioni di data policy dell'account). Uso il router free come riserva.",
      ),
      cheapModels,
    };
  }

  const enriched = await mapWithConcurrency(candidates, 4, async (model) => {
    const endpoint = await fetchEndpoints(model.id);
    const metrics = endpoint.metrics;
    const scores = scoreModel(model.id, model.name || model.id, metrics);
    const base = {
      id: model.id,
      name: model.name || model.id,
      provider: endpoint.provider,
      contextLength: model.context_length || 0,
      description: model.description,
      metrics,
      scores,
    };
    return { ...base, reason: reasonFor(base) } satisfies FreeModel;
  });

  enriched.sort((a, b) => b.scores.overall - a.scores.overall);

  const router: FreeModel = makeRouterModel(routerRaw);

  return {
    selected: enriched[0] || null,
    models: enriched,
    routerModel: router,
    cheapModels,
    fetchedAt: Date.now(),
    source: "live",
  };
}

function mergeDirect(registry: ModelRegistry | null): ModelRegistry {
  const direct = getDirectModels();
  const base: ModelRegistry = registry || {
    selected: null,
    models: [],
    routerModel: null,
    fetchedAt: Date.now(),
    source: "live",
  };
  if (!direct.length) return base;
  const models = [...direct, ...base.models];
  return { ...base, models, selected: direct[0] };
}

export async function getModelRegistry(force = false): Promise<ModelRegistry> {
  // Senza chiave OpenRouter si usano solo i provider diretti (se presenti).
  if (!hasOpenRouterKey()) {
    return mergeDirect(null);
  }
  return mergeDirect(await getOpenRouterRegistry(force));
}

async function getOpenRouterRegistry(force = false): Promise<ModelRegistry> {
  const store = cache();
  if (!force && store.registry && Date.now() - store.fetchedAt < CACHE_TTL_MS) {
    return store.registry;
  }
  if (store.inflight) return store.inflight;

  store.inflight = buildRegistry()
    .then((registry) => {
      store.registry = registry;
      store.fetchedAt = Date.now();
      return registry;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return fallbackRegistry(`Errore nella selezione del modello: ${message}`);
    })
    .finally(() => {
      store.inflight = null;
    });

  return store.inflight;
}

export function getPaidFallbackModel(): FreeModel {
  const id = process.env.OPENROUTER_PAID_FALLBACK_MODEL || "deepseek/deepseek-v4.1-flash";
  const labels = paidLabels(priceMap().get(id) || null);
  return {
    id,
    name: id.split("/")[1] || id,
    provider: "OpenRouter · riserva",
    contextLength: 128_000,
    metrics: { latencyMs: null, throughput: null, uptime: null },
    scores: { intelligence: 78, speed: 82, reliability: 92, overall: 82 },
    reason: "Riserva a pagamento, usata solo dopo free e tier economico.",
    isPaid: true,
    ...labels,
  };
}

/** Tier economico configurato/dinamico; vuoto se il catalogo non è disponibile e non c'è OPENROUTER_CHEAP_MODELS. */
export function getCheapTier(registry: ModelRegistry): FreeModel[] {
  if (registry.cheapModels) return registry.cheapModels;
  return buildCheapTier([]);
}

export async function resolveModel(
  requestedId: string | null | undefined,
  force = false,
): Promise<{ model: FreeModel; registry: ModelRegistry }> {
  const registry = await getModelRegistry(force);
  if (!requestedId) {
    return { model: pickDefault(registry), registry };
  }
  if (requestedId === "openrouter/free" && hasOpenRouterKey()) {
    return { model: registry.routerModel || makeRouterModel(), registry };
  }
  const found = registry.models.find((model) => model.id === requestedId);
  if (found) return { model: found, registry };
  return { model: pickDefault(registry), registry };
}

function pickDefault(registry: ModelRegistry): FreeModel {
  const model = registry.selected || registry.routerModel;
  if (model) return model;
  if (!hasOpenRouterKey()) {
    throw new OpenRouterError(
      "Nessun provider LLM configurato. Aggiungi almeno una chiave (GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY oppure OPENROUTER_API_KEY) in .env.local.",
      401,
      "missing_key",
    );
  }
  return getPaidFallbackModel();
}

export function getFallbackChain(
  primary: FreeModel,
  registry: ModelRegistry,
  allowPaidFallback: boolean,
): FreeModel[] {
  // Ordine: provider diretti free -> modelli OpenRouter free -> router free -> riserva a pagamento (opt-in).
  const ordered: FreeModel[] = [
    primary,
    ...registry.models.filter((model) => model.providerId),
    ...registry.models.filter((model) => !model.providerId),
  ];
  if (registry.routerModel) ordered.push(registry.routerModel);
  const seen = new Set<string>();
  const unique = ordered.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
  // Ordine: free pronti (max 6) -> [opt-in] tier economico (dal più economico) -> riserva fissa
  // -> modelli in cooldown (di solito sistematicamente falliti) come ultima spiaggia.
  const ready = unique.filter((model) => !isCoolingDown(model.id));
  const cooling = unique.filter((model) => isCoolingDown(model.id));
  const chain = ready.slice(0, MAX_FREE_ATTEMPTS);
  if (allowPaidFallback && hasOpenRouterKey()) {
    const paid = [...getCheapTier(registry), getPaidFallbackModel()];
    const paidSeen = new Set<string>();
    for (const model of paid) {
      if (paidSeen.has(model.id) || isCoolingDown(model.id)) continue;
      paidSeen.add(model.id);
      chain.push(model);
    }
  }
  chain.push(...ready.slice(MAX_FREE_ATTEMPTS), ...cooling);
  return chain;
}

export async function fetchOpenRouterKeyInfo(): Promise<{
  ok: boolean;
  label: string;
  keyMasked: string;
  freeUsed?: number;
  freeLimit?: number;
  credits?: number;
  error?: string;
}> {
  if (!hasOpenRouterKey()) {
    const active = getActiveDirectProviders();
    return {
      ok: active.length > 0,
      label: active.length
        ? `Provider free: ${active.map((p) => `${p.label} (${providerModelName(p)})`).join(", ")}`
        : "Nessun provider LLM",
      keyMasked: active.length ? "chiavi dirette" : "non configurata",
      error: active.length
        ? undefined
        : "Nessuna chiave LLM configurata (GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY o OPENROUTER_API_KEY).",
    };
  }
  try {
    const key = getOpenRouterKey();
    const payload = await fetchJson<{
      data?: {
        label?: string;
        free_model_daily_requests?: { used?: number; limit?: number };
      };
    }>(`${OPENROUTER_BASE}/key`);
    const creditsPayload = await fetchJson<{
      data?: { total_credits?: number; total_usage?: number };
    }>(`${OPENROUTER_BASE}/credits`).catch(() => null);
    const credits =
      creditsPayload?.data?.total_credits != null
        ? Math.max(0, creditsPayload.data.total_credits - (creditsPayload.data.total_usage || 0))
        : undefined;
    return {
      ok: true,
      label: payload.data?.label || "Chiave OpenRouter",
      keyMasked: maskKey(key),
      freeUsed: payload.data?.free_model_daily_requests?.used,
      freeLimit: payload.data?.free_model_daily_requests?.limit,
      credits,
    };
  } catch (error) {
    return {
      ok: false,
      label: "OpenRouter",
      keyMasked: process.env.OPENROUTER_API_KEY ? maskKey(process.env.OPENROUTER_API_KEY) : "non configurata",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

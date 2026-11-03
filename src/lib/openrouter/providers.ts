import type { FreeModel } from "@/lib/types";

/**
 * Provider LLM gratuiti con endpoint OpenAI-compatibile. Ognuno è attivo solo
 * se la relativa variabile d'ambiente con la chiave è presente.
 */
export interface DirectProvider {
  id: string;
  label: string;
  baseUrl: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  contextLength: number;
  /** Punteggio di priorità (più alto = provato prima). */
  quality: number;
}

export const DIRECT_PROVIDERS: DirectProvider[] = [
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
    contextLength: 131_072,
    quality: 80,
  },
  {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "gpt-oss-120b",
    contextLength: 65_000,
    quality: 79,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-flash-latest",
    contextLength: 1_000_000,
    quality: 85,
  },
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
    contextLength: 128_000,
    quality: 74,
  },
];

export function getProvider(id: string | undefined | null): DirectProvider | null {
  return DIRECT_PROVIDERS.find((provider) => provider.id === id) || null;
}

export function getActiveDirectProviders(): DirectProvider[] {
  return DIRECT_PROVIDERS.filter((provider) => Boolean(process.env[provider.keyEnv]?.trim()));
}

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function providerModelName(provider: DirectProvider): string {
  return process.env[provider.modelEnv]?.trim() || provider.defaultModel;
}

export function providerApiKey(provider: DirectProvider): string {
  return process.env[provider.keyEnv]?.trim() || "";
}

/** Modelli dei provider diretti attivi, nell'ordine di provata. */
export function getDirectModels(): FreeModel[] {
  return getActiveDirectProviders().map((provider) => {
    const name = providerModelName(provider);
    return {
      id: `${provider.id}:${name}`,
      name: `${provider.label}: ${name} (free)`,
      provider: provider.label,
      providerId: provider.id,
      baseUrl: provider.baseUrl,
      contextLength: provider.contextLength,
      metrics: { latencyMs: null, throughput: null, uptime: null },
      scores: {
        intelligence: provider.quality,
        speed: 90,
        reliability: 85,
        overall: provider.quality + 5,
      },
      reason: `Provider gratuito diretto (${provider.label}), nessun costo.`,
    } satisfies FreeModel;
  });
}

/** Nome del modello da inviare all'API del provider (senza prefisso interno). */
export function apiModelName(model: FreeModel): string {
  if (model.providerId && model.id.startsWith(`${model.providerId}:`)) {
    return model.id.slice(model.providerId.length + 1);
  }
  return model.id;
}

// --- Cooldown in memoria per modelli che hanno risposto 429 -----------------

const COOLDOWN_MS = 60_000;
const globalForCooldown = globalThis as unknown as { __bazaarCooldown?: Map<string, number> };

function cooldowns(): Map<string, number> {
  if (!globalForCooldown.__bazaarCooldown) globalForCooldown.__bazaarCooldown = new Map();
  return globalForCooldown.__bazaarCooldown;
}

export function markCooldown(modelId: string, ms = COOLDOWN_MS) {
  cooldowns().set(modelId, Date.now() + ms);
}

export function isCoolingDown(modelId: string): boolean {
  const until = cooldowns().get(modelId);
  if (!until) return false;
  if (until <= Date.now()) {
    cooldowns().delete(modelId);
    return false;
  }
  return true;
}

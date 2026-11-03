import { explicitCityInText } from "@/lib/agent/city";
import { enrichWithDescriptions } from "@/lib/agent/enrich";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import {
  REFUSALS,
  buildGuardMessages,
  parseGuardReply,
  ruleCheck,
  type GuardVerdict,
} from "@/lib/agent/guard";
import { getMcpManager } from "@/lib/mcp/manager";
import { toolLabel } from "@/lib/mcp/config";
import {
  compactToolOutputForModel,
  filterOutputByCity,
  normalizeToolOutput,
  summarizeToolContentForModel,
  type ToolOutput,
} from "@/lib/mcp/normalize";
import {
  OpenRouterError,
  getFallbackChain,
  getModelRegistry,
  getPaidFallbackModel,
  resolveModel,
} from "@/lib/openrouter/models";
import { COOLDOWN_LONG_MS, COOLDOWN_SHORT_MS, markCooldown } from "@/lib/openrouter/providers";
import {
  streamChatCompletion,
  type OpenRouterMessage,
  type OpenRouterTool,
  type OpenRouterToolCall,
} from "@/lib/openrouter/client";
import type {
  AgentEvent,
  ChatRequestBody,
  ChatUsage,
  FreeModel,
  MarketplaceId,
  Product,
  ToolActivity,
} from "@/lib/types";

const MAX_ROUNDS = 4;
const MAX_TOOL_CALLS_PER_ROUND = 10;
const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 3_000;
const MAX_TOOL_CHARS = 6_000;

function cleanHistory(messages: ChatRequestBody["messages"]): Array<{ role: "user" | "assistant"; content: string }> {
  const cleaned = (messages || [])
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, MAX_MESSAGE_CHARS).trim(),
    }))
    .filter((message) => message.content.length > 0);
  return cleaned.slice(-MAX_HISTORY_MESSAGES);
}

function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function prepareToolArguments(
  tool: string,
  args: Record<string, unknown>,
  city: string,
  supportsJson: boolean,
  hasCityParam: boolean,
): Record<string, unknown> {
  const prepared: Record<string, unknown> = { ...args };
  // I modelli piccoli riempiono i parametri opzionali con segnaposto ("n/d", "null"...):
  // un url="n/d" fa ignorare la query. Meglio non passarli affatto.
  for (const [key, value] of Object.entries(prepared)) {
    if (value === null || value === undefined) delete prepared[key];
    else if (typeof value === "string" && /^\s*(?:|n\/?d|n\/?a|null|none|undefined|nan|-+)\s*$/i.test(value)) {
      delete prepared[key];
    }
  }

  if (tool.startsWith("search_")) {
    // Il limite scelto dal modello non conta: chiedere più annunci al server non costa token
    // (al modello ne arrivano comunque pochi) ma dà alla Bacheca e ai filtri più materiale.
    prepared.limit = 24;
  }
  // La città (impostazioni, o quella nominata esplicitamente dall'utente) vince sempre su quella scelta dal modello.
  if (hasCityParam || tool === "search_marketplace") prepared.city = city;
  if (tool === "search_marketplace") {
    const radius = Number(prepared.radius_km);
    prepared.radius_km = Number.isFinite(radius) ? Math.max(1, Math.min(120, Math.trunc(radius))) : 30;
  }
  if (tool === "search_subito") {
    delete prepared.format;
  } else if (supportsJson) {
    prepared.format = "json";
  }
  return prepared;
}

function supportsJsonFormat(tools: OpenRouterTool[], toolName: string): boolean {
  const tool = tools.find((entry) => entry.function.name === toolName);
  const properties = tool?.function.parameters?.properties as Record<string, unknown> | undefined;
  return Boolean(properties && "format" in properties);
}

function supportsParam(tools: OpenRouterTool[], toolName: string, param: string): boolean {
  const tool = tools.find((entry) => entry.function.name === toolName);
  const properties = tool?.function.parameters?.properties as Record<string, unknown> | undefined;
  return Boolean(properties && param in properties);
}

/** Accorcia descrizioni e proprietà dei tool: gli schemi vengono rimandati ad ogni round. */
function compactTools(tools: OpenRouterTool[]): OpenRouterTool[] {
  const shorten = (text: unknown, max: number): string | undefined => {
    if (typeof text !== "string") return undefined;
    const first = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] || "";
    return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
  };
  const compactSchema = (schema: unknown, depth = 0): unknown => {
    if (!schema || typeof schema !== "object") return schema;
    if (Array.isArray(schema)) return schema.map((item) => compactSchema(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (key === "title" || key === "examples" || key === "$schema") continue;
      if (key === "description") {
        const text = shorten(value, 70);
        if (text) out.description = text;
        continue;
      }
      out[key] = key === "properties" && value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([name, prop]) => [
              name,
              compactSchema(prop, depth + 1),
            ]),
          )
        : compactSchema(value, depth + 1);
    }
    return out;
  };
  return tools.map((tool) => ({
    ...tool,
    function: {
      ...tool.function,
      description: shorten(tool.function.description, 140) || tool.function.name,
      parameters: compactSchema(tool.function.parameters) as Record<string, unknown>,
    },
  }));
}

function priceTag(model: FreeModel): string {
  return model.pricePerMillion != null
    ? ` · a pagamento ~$${model.pricePerMillion.toFixed(model.pricePerMillion < 0.1 ? 3 : 2)}/1M token`
    : " · a pagamento";
}

function shortModelLabel(model: FreeModel): string {
  const name = model.name
    .replace(/\s*\(free\)\s*/i, "")
    .replace(/^OpenRouter:\s*/i, "")
    .trim();
  return `${name}${model.isPaid ? priceTag(model) : " · free"}`;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

function isRetryableModelError(error: unknown): boolean {
  if (error instanceof OpenRouterError) {
    return [400, 403, 404, 408, 413, 429, 500, 502, 503, 504].includes(error.status) || error.status === 0;
  }
  return error instanceof TypeError;
}

async function callModelWithFallback(options: {
  primary: FreeModel;
  registry: Awaited<ReturnType<typeof getModelRegistry>>;
  allowPaidFallback: boolean;
  messages: OpenRouterMessage[];
  tools: OpenRouterTool[];
  toolChoice?: "auto" | "required";
  maxTokens?: number;
  signal?: AbortSignal;
  emit: (event: AgentEvent) => void;
}): Promise<{
  model: FreeModel;
  content: string;
  toolCalls: OpenRouterToolCall[];
  finishReason: string | null;
  usage?: ChatUsage;
  fallbackUsed: boolean;
}> {
  const chain = getFallbackChain(options.primary, options.registry, options.allowPaidFallback);
  let lastError: unknown = null;

  for (let index = 0; index < chain.length; index += 1) {
    const model = chain[index];
    let emitted = false;
    let announced = index === 0;
    const announceFallback = () => {
      if (announced) return;
      announced = true;
      options.emit({
        type: "meta",
        model,
        modelLabel: shortModelLabel(model),
        fallback: Boolean(model.isPaid),
      });
    };
    try {
      if (index > 0) {
        options.emit({
          type: "notice",
          message: model.isPaid
            ? `Nessun modello gratuito utilizzabile. Uso ${model.name} (a pagamento${
                model.pricePerMillion != null ? `, ~$${model.pricePerMillion.toFixed(model.pricePerMillion < 0.1 ? 3 : 2)} per 1M token` : ""
              })…`
            : `Il modello precedente non è disponibile. Provo con ${model.name}…`,
        });
      }
      let result: Awaited<ReturnType<typeof streamChatCompletion>> | null = null;
      // Un breve retry sullo stesso modello su 429 prima di scartarlo.
      for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
        try {
          result = await streamChatCompletion({
            target: model,
            messages: options.messages,
            tools: options.tools,
            toolChoice: options.toolChoice,
            maxTokens: options.maxTokens,
            signal: options.signal,
            onDelta: (delta) => {
              emitted = true;
              announceFallback();
              options.emit({ type: "delta", text: delta });
            },
          });
        } catch (error) {
          const retry429 =
            error instanceof OpenRouterError && error.status === 429 && !emitted && attempt === 0;
          if (!retry429 || options.signal?.aborted) throw error;
          await sleep(1500, options.signal);
        }
      }
      if (!result) throw new OpenRouterError("Risposta vuota dal modello.", 502);
      if (
        result.discardedToolCallText &&
        !result.content.trim() &&
        !result.toolCalls.length
      ) {
        throw new OpenRouterError(
          "Il modello ha scritto una chiamata tool non valida. Provo un altro modello.",
          502,
          "invalid_tool_call",
        );
      }
      if (!result.content.trim() && !result.toolCalls.length && !emitted) {
        throw new OpenRouterError(
          "Il modello ha risposto a vuoto. Provo un altro modello.",
          502,
          "empty_response",
        );
      }
      announceFallback();
      return {
        model,
        content: result.content,
        toolCalls: result.toolCalls,
        finishReason: result.finishReason,
        usage: result.usage,
        fallbackUsed: index > 0,
      };
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw error;
      if (error instanceof OpenRouterError) {
        const systematic =
          [400, 404].includes(error.status) || error.code === "invalid_tool_call";
        console.warn(
          `[bazaar] ${model.id} ha fallito (${error.status}${error.code ? `/${error.code}` : ""}): ${error.message.slice(0, 200)}${
            systematic ? " -> cooldown lungo" : ""
          }`,
        );
        markCooldown(model.id, systematic ? COOLDOWN_LONG_MS : COOLDOWN_SHORT_MS);
      }
      if (emitted || !isRetryableModelError(error)) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new OpenRouterError("Nessun modello LLM disponibile.", 503);
}

/**
 * Guardrail: prima di spendere ricerche e token, un modello veloce valuta se l'ultimo messaggio
 * è una richiesta legittima per Bazaar. Regole deterministiche → modello → (se tutti falliscono) vedi GUARD_FAIL_MODE.
 */
async function checkRequest(options: {
  history: ReturnType<typeof cleanHistory>;
  registry: Awaited<ReturnType<typeof getModelRegistry>>;
  signal?: AbortSignal;
}): Promise<GuardVerdict> {
  const last = options.history[options.history.length - 1].content;
  const byRules = ruleCheck(last);
  if (byRules) return byRules;
  if (process.env.GUARD_DISABLED === "true") return { ok: true, source: "non_verificato" };

  // Modello più veloce tra i free con qualità decente: il compito è una classificazione breve.
  const fast = options.registry.models
    .filter((model) => model.scores.intelligence >= 50)
    .sort((a, b) => b.scores.speed - a.scores.speed)[0] ?? options.registry.selected ?? options.registry.routerModel;
  const primary = process.env.GUARD_MODEL
    ? options.registry.models.find((model) => model.id === process.env.GUARD_MODEL) ?? fast
    : fast;
  if (!primary) return failVerdict();

  try {
    const result = await Promise.race([
      callModelWithFallback({
        primary,
        registry: options.registry,
        allowPaidFallback: false,
        messages: buildGuardMessages(options.history),
        tools: [],
        signal: options.signal,
        emit: () => {}, // la decisione del filtro non va mostrata all'utente
        maxTokens: 60,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("guard timeout")), 15_000)),
    ]);
    const verdict = parseGuardReply(result.content);
    if (verdict) return verdict;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    console.warn(`[bazaar] guardrail non disponibile: ${error instanceof Error ? error.message : error}`);
  }
  return failVerdict();
}

/** Se il filtro non risponde: di default lascia passare (le regole deterministiche sono già state applicate). */
function failVerdict(): GuardVerdict {
  if (process.env.GUARD_FAIL_MODE === "closed") return { ok: false, category: "fuori_tema", source: "non_verificato" };
  return { ok: true, source: "non_verificato" };
}

export async function runAgent(options: {
  body: ChatRequestBody;
  signal?: AbortSignal;
  emit: (event: AgentEvent) => void;
}): Promise<void> {
  const { body, signal, emit } = options;
  const history = cleanHistory(body.messages || []);
  if (!history.length || history[history.length - 1].role !== "user") {
    throw new Error("La richiesta non contiene un messaggio utente.");
  }

  const settingsCity = (body.city || "Milano").trim() || "Milano";
  // La città delle Impostazioni vince, salvo che l'ultimo messaggio ne nomini esplicitamente un'altra.
  const explicitCity = explicitCityInText(history[history.length - 1].content);
  const city = explicitCity || settingsCity;
  const requestedMarketplaces = Array.isArray(body.marketplaces)
    ? body.marketplaces.filter((id): id is MarketplaceId =>
        ["amazon", "ebay", "aliexpress", "vinted", "subito", "facebook-marketplace"].includes(id),
      )
    : undefined;

  const manager = getMcpManager();
  await manager.ensureAll();
  const status = manager.getStatus();
  const online = status
    .filter((server) => server.status === "online")
    .map((server) => server.id)
    .filter((id) => !requestedMarketplaces || requestedMarketplaces.includes(id));
  const offline = status
    .filter((server) => server.status !== "online")
    .map((server) => server.id)
    .filter((id) => !requestedMarketplaces || requestedMarketplaces.includes(id));

  const { model: initialModel, registry } = await resolveModel(body.model, false);

  const verdict = await checkRequest({ history, registry, signal });
  if (!verdict.ok) {
    console.log(`[bazaar] guardrail: richiesta bloccata (${verdict.category}, ${verdict.source})`);
    emit({ type: "delta", text: REFUSALS[verdict.category ?? "fuori_tema"] });
    emit({ type: "done", modelLabel: "Filtro Bazaar" });
    return;
  }
  emit({
    type: "meta",
    model: initialModel,
    modelLabel: shortModelLabel(initialModel),
    fallback: Boolean(initialModel.isPaid),
  });
  if (registry.source === "fallback" && registry.note) {
    emit({ type: "notice", message: registry.note });
  }

  const tools = compactTools(manager.getOpenAiTools(online) as OpenRouterTool[]);
  if (!tools.length) {
    throw new Error(
      "Nessun marketplace è connesso. Apri “Connessioni”, controlla i server MCP e riprova.",
    );
  }

  const allowPaidFallback =
    Boolean(body.allowPaidFallback) &&
    process.env.OPENROUTER_ALLOW_PAID_FALLBACK === "true" &&
    Boolean(process.env.OPENROUTER_API_KEY);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt({ online, offline, city }),
    },
    ...history,
  ];

  let totalUsage: ChatUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let modelUsed = initialModel;
  let anyText = false;
  let foundProducts = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const result = await callModelWithFallback({
      primary: modelUsed,
      registry,
      allowPaidFallback,
      messages,
      // Dopo il primo giro con risultati sufficienti il modello deve solo rispondere:
      // un secondo giro di raffinamento costa token e spesso torna a 0.
      tools: round > 0 && foundProducts >= 3 ? [] : tools,
      // Ogni messaggio dell'utente richiede una ricerca reale: le risposte precedenti non contengono i dati dei tool,
      // quindi senza nuova ricerca il modello inventerebbe (es. località) da una risposta già scritta.
      toolChoice: round === 0 ? "required" : "auto",
      signal,
      emit,
    });
    modelUsed = result.model;
    if (result.usage) {
      totalUsage = {
        promptTokens: totalUsage.promptTokens + result.usage.promptTokens,
        completionTokens: totalUsage.completionTokens + result.usage.completionTokens,
        totalTokens: totalUsage.totalTokens + result.usage.totalTokens,
      };
    }
    if (result.content.trim()) anyText = true;

    const toolCalls = result.toolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND);
    if (round === 0) {
      // I modelli piccoli saltano spesso dei marketplace: copro io quelli attivi rimasti
      // con la stessa query (le ricerche sono parallele e gratuite, pesano solo nel contesto).
      const searched = new Set(toolCalls.map((call) => manager.resolveTool(call.function.name)?.server));
      const first = toolCalls.find((call) => manager.resolveTool(call.function.name)?.tool.startsWith("search_"));
      const query = first ? parseToolArguments(first.function.arguments).query : null;
      if (typeof query === "string" && query.trim()) {
        for (const server of online) {
          if (searched.has(server) || toolCalls.length >= MAX_TOOL_CALLS_PER_ROUND) continue;
          const name = tools
            .map((tool) => tool.function.name)
            .find((n) => {
              const resolved = manager.resolveTool(n);
              return resolved?.server === server && resolved.tool.startsWith("search_");
            });
          if (!name) continue;
          toolCalls.push({
            id: `call_auto_${server}_${Date.now()}`,
            type: "function",
            function: { name, arguments: JSON.stringify({ query: query.trim() }) },
          });
        }
      }
    }
    if (!toolCalls.length) {
      if (!result.content.trim() && !anyText) {
        throw new Error("Il modello non ha prodotto una risposta. Riprova con una richiesta più specifica.");
      }
      emit({
        type: "done",
        usage: totalUsage.totalTokens ? totalUsage : undefined,
        modelLabel: shortModelLabel(modelUsed),
      });
      return;
    }

    // I risultati dei round precedenti sono già stati letti dal modello:
    // li sostituisco con un riassunto minimo per non rimandarli ad ogni giro.
    for (const message of messages) {
      if (message.role === "tool" && !message.content.includes('"riassunto"')) {
        message.content = summarizeToolContentForModel(message.content);
      }
    }

    messages.push({
      role: "assistant",
      content: result.content || null,
      tool_calls: toolCalls,
    });

    const activities: ToolActivity[] = toolCalls.map((call) => {
      const resolved = manager.resolveTool(call.function.name);
      return {
        id: call.id,
        server: resolved?.server || "unknown",
        tool: call.function.name,
        label: toolLabel(resolved?.server || "", call.function.name),
        args: parseToolArguments(call.function.arguments),
        status: "running",
        startedAt: Date.now(),
      };
    });

    for (const activity of activities) emit({ type: "activity", activity });

    const executions = await Promise.all(
      toolCalls.map(async (call, index) => {
        const activity = activities[index];
        const resolved = manager.resolveTool(call.function.name);
        if (!resolved) {
          return {
            call,
            activity: {
              ...activity,
              status: "error" as const,
              durationMs: 0,
              error: `Tool sconosciuto: ${call.function.name}`,
            },
            modelContent: JSON.stringify({ errore: `Tool sconosciuto: ${call.function.name}` }),
            products: [] as Product[],
            output: null as ToolOutput | null,
            server: null as MarketplaceId | null,
            tool: "",
            isError: true,
          };
        }

        const args = prepareToolArguments(
          resolved.tool,
          parseToolArguments(call.function.arguments),
          city,
          supportsJsonFormat(tools, resolved.tool),
          supportsParam(tools, resolved.tool, "city"),
        );
        activity.args = args;
        emit({ type: "activity", activity: { ...activity, args } });

        const raw = await manager.callTool(resolved.server, resolved.tool, args);
        const rawOutput = normalizeToolOutput(resolved.server, resolved.tool, raw.text);
        const output = explicitCity
          ? filterOutputByCity(resolved.server, rawOutput, explicitCity)
          : rawOutput;
        const isError = raw.isError || Boolean(output.error);
        const modelContent = compactToolOutputForModel(resolved.server, resolved.tool, output);
        const updated: ToolActivity = {
          ...activity,
          args,
          status: isError ? "error" : "done",
          durationMs: raw.durationMs,
          count: output.products.length,
          error: isError ? output.error || "Errore dal marketplace" : undefined,
          products: output.products,
        };
        emit({ type: "activity", activity: updated });

        return {
          call,
          activity: updated,
          modelContent: isError
            ? JSON.stringify({ errore: updated.error || "Errore dal marketplace" })
            : modelContent,
          products: output.products,
          output: output as ToolOutput | null,
          server: resolved.server as MarketplaceId | null,
          tool: resolved.tool,
          isError,
        };
      }),
    );

    // Descrizioni degli annunci: il modello le usa per verificare i vincoli dell'utente (quantità, kit, formato...).
    const searches = executions.flatMap((e) =>
      e.output && e.server && e.tool.startsWith("search_") && !e.isError
        ? [{ e, server: e.server, tool: e.tool, output: e.output }]
        : [],
    );
    if (searches.length) {
      const changed = await enrichWithDescriptions(
        searches.map((s) => ({ ...s, ok: true })),
        signal,
      );
      for (const s of searches) {
        s.e.modelContent = compactToolOutputForModel(s.server, s.tool, s.output);
        if (changed) emit({ type: "activity", activity: { ...s.e.activity, products: s.output.products } });
      }
    }

    if (explicitCity) {
      const names: Record<string, string> = { subito: "Subito", "facebook-marketplace": "Facebook Marketplace" };
      const local = executions.filter((e) => e.activity.server in names && e.activity.status === "done");
      if (local.length) {
        const parts = local.map((e) => `${names[e.activity.server]} ${e.activity.count ?? 0}`);
        emit({
          type: "notice",
          message: `Annunci locali a ${explicitCity}: ${parts.join(" · ")}. Amazon, eBay, AliExpress e Vinted spediscono da altrove.`,
        });
      }
    }

    const priced = executions
      .flatMap((execution) => execution.products)
      .filter((product) => typeof product.price === "number" && product.price > 0);
    const cheapest = priced.sort((a, b) => (a.price as number) - (b.price as number))[0];
    if (cheapest) {
      const last = executions[executions.length - 1];
      last.modelContent += `\n[Riepilogo calcolato: prezzo numerico più basso tra tutti i risultati = ${cheapest.price} € — "${cheapest.title.slice(0, 80)}" su ${cheapest.marketplace}]`;
    }

    {
      const withDesc = executions.reduce((n, e) => n + e.modelContent.length, 0);
      const descChars = executions.reduce(
        (n, e) => n + (e.modelContent.match(/"descrizione":"(?:[^"\\]|\\.)*"/g) || []).reduce((s, m) => s + m.length, 0),
        0,
      );
      console.log(`[bazaar] contenuto tool per il modello: ${withDesc} car. (di cui descrizioni ${descChars})`);
    }
    for (const execution of executions) {
      foundProducts += execution.products.length;
      console.log(
        `[bazaar] ${execution.call.function.name} ${execution.call.function.arguments.slice(0, 160)} -> ${execution.products.length}`,
      );
      messages.push({
        role: "tool",
        tool_call_id: execution.call.id,
        content: execution.modelContent.slice(0, MAX_TOOL_CHARS),
      });
    }

    if (round === MAX_ROUNDS - 1) {
      emit({
        type: "notice",
        message: "Ho raggiunto il limite di ricerche per questa risposta. Concludo con i dati raccolti.",
      });
    }
  }

  // Ultimo giro senza tool: obbliga il modello a scrivere la risposta finale
  // usando i risultati già raccolti.
  const finalResult = await callModelWithFallback({
    primary: modelUsed,
    registry,
    allowPaidFallback,
    messages,
    tools: [],
    signal,
    emit,
  });
  modelUsed = finalResult.model;
  if (finalResult.usage) {
    totalUsage = {
      promptTokens: totalUsage.promptTokens + finalResult.usage.promptTokens,
      completionTokens: totalUsage.completionTokens + finalResult.usage.completionTokens,
      totalTokens: totalUsage.totalTokens + finalResult.usage.totalTokens,
    };
  }
  if (!finalResult.content.trim() && !anyText) {
    throw new Error("Il modello non ha prodotto una risposta. Riprova con una richiesta più specifica.");
  }

  emit({
    type: "done",
    usage: totalUsage.totalTokens ? totalUsage : undefined,
    modelLabel: shortModelLabel(modelUsed),
  });
}

export function describeModelForClient(model: FreeModel): FreeModel {
  return {
    ...model,
    description: model.description?.slice(0, 280),
  };
}

export function paidFallbackAvailable(): boolean {
  return process.env.OPENROUTER_ALLOW_PAID_FALLBACK === "true" && Boolean(process.env.OPENROUTER_API_KEY);
}

export { getPaidFallbackModel };

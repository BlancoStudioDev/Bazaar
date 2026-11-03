import { OpenRouterError, openRouterHeaders } from "@/lib/openrouter/models";
import { apiModelName, getProvider, providerApiKey } from "@/lib/openrouter/providers";
import type { ChatUsage, FreeModel } from "@/lib/types";

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenRouterToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamChatOptions {
  /** Modello completo (provider diretto o OpenRouter). */
  target: FreeModel;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamChatResult {
  content: string;
  toolCalls: OpenRouterToolCall[];
  finishReason: string | null;
  usage?: ChatUsage;
  /** True when the model wrote tool-call markup as text but no valid call could be parsed. */
  discardedToolCallText?: boolean;
}

const TOOL_CALL_OPEN = "<tool_call>";
const TOOL_CALL_CLOSE = "</tool_call>";

function partialTagSuffix(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let length = max; length > 0; length -= 1) {
    if (text.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

/**
 * Some free models (notably XingChen/TeleChat) do not use the native tool-call
 * channel: they write `<tool_call>name<param_key>…</param_key>…</tool_call>`
 * as normal text. This filter keeps that markup out of the chat stream and
 * collects it so it can be turned into real tool calls.
 */
class ToolCallTextFilter {
  private pending = "";
  private inside = false;
  private current = "";
  private readonly blocks: string[] = [];
  private readonly emit: (text: string) => void;

  constructor(emit: (text: string) => void) {
    this.emit = emit;
  }

  push(delta: string): void {
    this.pending += delta;
    this.drain(false);
  }

  finish(): string[] {
    this.drain(true);
    return this.blocks;
  }

  private drain(final: boolean): void {
    for (;;) {
      if (this.inside) {
        const end = this.pending.indexOf(TOOL_CALL_CLOSE);
        if (end === -1) {
          if (final) {
            this.current += this.pending;
            this.blocks.push(this.current);
            this.current = "";
            this.pending = "";
          } else {
            const keep = partialTagSuffix(this.pending, TOOL_CALL_CLOSE);
            const cut = this.pending.length - keep;
            if (cut > 0) {
              this.current += this.pending.slice(0, cut);
              this.pending = this.pending.slice(cut);
            }
          }
          return;
        }
        this.current += this.pending.slice(0, end);
        this.blocks.push(this.current);
        this.current = "";
        this.pending = this.pending.slice(end + TOOL_CALL_CLOSE.length);
        this.inside = false;
        continue;
      }

      const start = this.pending.indexOf(TOOL_CALL_OPEN);
      if (start === -1) {
        if (final) {
          if (this.pending) this.emit(this.pending);
          this.pending = "";
          return;
        }
        const keep = partialTagSuffix(this.pending, TOOL_CALL_OPEN);
        const cut = this.pending.length - keep;
        if (cut > 0) {
          this.emit(this.pending.slice(0, cut));
          this.pending = this.pending.slice(cut);
        }
        return;
      }
      if (start > 0) this.emit(this.pending.slice(0, start));
      this.pending = this.pending.slice(start + TOOL_CALL_OPEN.length);
      this.inside = true;
      this.current = "";
    }
  }
}

function parsePseudoToolCalls(
  blocks: string[],
  allowed: Set<string>,
): OpenRouterToolCall[] {
  const calls: OpenRouterToolCall[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as {
          name?: unknown;
          arguments?: unknown;
          parameters?: unknown;
        };
        const name = typeof parsed.name === "string" ? parsed.name : "";
        if (!name || !allowed.has(name)) continue;
        const args = parsed.arguments ?? parsed.parameters ?? {};
        calls.push({
          id: `call_pseudo_${calls.length}_${Date.now()}`,
          type: "function",
          function: {
            name,
            arguments: typeof args === "string" ? args : JSON.stringify(args),
          },
        });
      } catch {
        // malformed JSON: ignore this block
      }
      continue;
    }

    const nameMatch = trimmed.match(/^([A-Za-z0-9_]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (!allowed.has(name)) continue;

    const args: Record<string, string> = {};
    const pair = /<param_key>([\s\S]*?)<\/param_key>\s*<param_value>([\s\S]*?)<\/param_value>/g;
    let match: RegExpExecArray | null;
    while ((match = pair.exec(trimmed))) {
      const key = match[1].trim();
      if (key) args[key] = match[2].trim();
    }
    calls.push({
      id: `call_pseudo_${calls.length}_${Date.now()}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
  }

  return calls;
}

interface StreamChunk {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string | Record<string, unknown> };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: number | string; metadata?: Record<string, unknown> };
}

function friendlyStatus(status: number, label = "OpenRouter"): string {
  if (label !== "OpenRouter") {
    if (status === 401 || status === 403) return `Chiave ${label} non valida o senza permessi (${status}).`;
    if (status === 429) return `${label} è temporaneamente saturo (limite free raggiunto).`;
    if (status === 404) return `Modello non disponibile su ${label}.`;
    return `${label} ha risposto con errore ${status}.`;
  }
  switch (status) {
    case 400:
      return "OpenRouter ha rifiutato la richiesta (400). Riprova con una domanda più semplice.";
    case 401:
      return "Chiave OpenRouter non valida o scaduta. Controlla OPENROUTER_API_KEY in .env.local.";
    case 402:
      return "Crediti OpenRouter insufficienti per usare un modello a pagamento.";
    case 403:
      return "OpenRouter ha bloccato la richiesta (403).";
    case 404:
      return "Il modello gratuito non è più raggiungibile su OpenRouter. Riprova con la riserva economica.";
    case 429:
      return "Il modello gratuito è temporaneamente saturo su OpenRouter. Riprova tra 30-60 secondi; se continua, attiva la riserva economica.";
    case 502:
    case 503:
    case 504:
      return "OpenRouter o il provider del modello non stanno rispondendo. Riprova tra poco.";
    default:
      return `OpenRouter ha risposto con errore ${status}.`;
  }
}

function parseErrorMessage(status: number, raw: string, label = "OpenRouter"): string {
  if (label !== "OpenRouter") {
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string } | Array<{ error?: { message?: string } }>;
      detail = (Array.isArray(parsed) ? parsed[0]?.error?.message : parsed.error?.message || parsed.message) || "";
    } catch {
      // ignore
    }
    return `${friendlyStatus(status, label)}${detail && status !== 429 ? ` (${detail.slice(0, 200)})` : ""}`;
  }
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; code?: number | string };
      message?: string;
    };
    const detail = parsed.error?.message || parsed.message;
    if (detail) {
      if (/guardrail|zdr|data policy/i.test(detail)) {
        return "Il provider gratuito ha bloccato questa richiesta per criteri di data policy. Riprova con la riserva economica.";
      }
      if (status === 429) {
        const extra = /provider returned error/i.test(detail)
          ? ""
          : ` (${detail.slice(0, 220)})`;
        return `${friendlyStatus(429)}${extra}`;
      }
      return `${friendlyStatus(status)} (${detail.slice(0, 260)})`;
    }
  } catch {
    // ignore
  }
  return friendlyStatus(status);
}

export async function streamChatCompletion(
  options: StreamChatOptions,
): Promise<StreamChatResult> {
  const { target, messages, tools, signal, onDelta } = options;
  const provider = getProvider(target.providerId);
  const label = provider?.label || "OpenRouter";
  const model = apiModelName(target);

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1200,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const endpoint = provider
    ? `${provider.baseUrl}/chat/completions`
    : "https://openrouter.ai/api/v1/chat/completions";
  const headers: Record<string, string> = provider
    ? { Authorization: `Bearer ${providerApiKey(provider)}`, "Content-Type": "application/json" }
    : openRouterHeaders({ "Content-Type": "application/json" });
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new OpenRouterError(parseErrorMessage(response.status, raw, label), response.status);
  }
  if (!response.body) {
    throw new OpenRouterError(`${label} non ha restituito uno stream.`, 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | null = null;
  let usage: ChatUsage | undefined;
  const allowedTools = new Set((tools || []).map((tool) => tool.function.name));
  const textFilter = new ToolCallTextFilter((text) => {
    content += text;
    onDelta?.(text);
  });
  const toolAccumulator = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  const handleChunk = (chunk: StreamChunk) => {
    if (chunk.error) {
      const status =
        typeof chunk.error.code === "number" ? chunk.error.code : Number(chunk.error.code) || 500;
      throw new OpenRouterError(
        parseErrorMessage(status, JSON.stringify({ error: chunk.error })),
        status,
        String(chunk.error.code ?? ""),
      );
    }
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens || 0,
        completionTokens: chunk.usage.completion_tokens || 0,
        totalTokens: chunk.usage.total_tokens || 0,
      };
    }
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;

    const delta = choice.delta;
    if (!delta) return;
    if (typeof delta.content === "string" && delta.content.length > 0) {
      textFilter.push(delta.content);
    }

    for (let index = 0; index < (delta.tool_calls?.length || 0); index += 1) {
      const part = delta.tool_calls?.[index];
      if (!part) continue;
      const key = typeof part.index === "number" ? part.index : index;
      const existing = toolAccumulator.get(key) || {
        id: "",
        name: "",
        arguments: "",
      };
      if (part.id) existing.id = part.id;
      if (part.function?.name) existing.name += part.function.name;
      if (part.function?.arguments != null) {
        existing.arguments +=
          typeof part.function.arguments === "string"
            ? part.function.arguments
            : JSON.stringify(part.function.arguments);
      }
      toolAccumulator.set(key, existing);
    }
  };

  const processBuffer = (flush = false) => {
    const lines = buffer.split("\n");
    buffer = flush ? "" : lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let parsed: StreamChunk;
      try {
        parsed = JSON.parse(data) as StreamChunk;
      } catch {
        continue;
      }
      handleChunk(parsed);
    }
    if (flush && buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice(5).trim();
        if (data && data !== "[DONE]") {
          try {
            handleChunk(JSON.parse(data) as StreamChunk);
          } catch {
            // ignore
          }
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    processBuffer();
  }
  buffer += decoder.decode();
  processBuffer(true);

  const pseudoBlocks = textFilter.finish();
  const pseudoCalls = parsePseudoToolCalls(pseudoBlocks, allowedTools);
  const discardedToolCallText = pseudoBlocks.length > 0 && pseudoCalls.length === 0;

  const nativeCalls: OpenRouterToolCall[] = Array.from(toolAccumulator.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value], index) => ({
      id: value.id || `call_${index}_${Date.now()}`,
      type: "function" as const,
      function: {
        name: value.name,
        arguments: value.arguments || "{}",
      },
    }))
    .filter((call) => Boolean(call.function.name));

  const seen = new Set<string>();
  const toolCalls = [...nativeCalls, ...pseudoCalls].filter((call) => {
    const key = `${call.function.name}:${call.function.arguments}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { content, toolCalls, finishReason, usage, discardedToolCallText };
}

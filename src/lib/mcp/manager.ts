import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  getMcpServerConfigs,
  missingServerFiles,
  type McpServerConfig,
} from "@/lib/mcp/config";
import type { MarketplaceId, McpServerInfo, ServerStatus } from "@/lib/types";

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

interface ServerRuntime {
  config: McpServerConfig;
  client: Client | null;
  transport: StdioClientTransport | null;
  status: ServerStatus;
  tools: McpToolDefinition[];
  error?: string;
  latencyMs?: number;
  connectedAt?: number;
  lastAttemptAt?: number;
  lastUsed?: number;
  stderr: string;
}

export interface ToolCallResult {
  text: string;
  isError: boolean;
  durationMs: number;
}

const CONNECT_TIMEOUT_MS = 25_000;
const RETRY_COOLDOWN_MS = 20_000;

const RESULT_CACHE_TTL_MS = 10 * 60 * 1000;
const RESULT_CACHE_MAX = 100;
const globalForResults = globalThis as unknown as {
  __bazaarMcpResults?: Map<string, { at: number; value: ToolCallResult }>;
};

function resultCache() {
  if (!globalForResults.__bazaarMcpResults) globalForResults.__bazaarMcpResults = new Map();
  return globalForResults.__bazaarMcpResults;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  if (typeof value === "string") return JSON.stringify(value.trim().toLowerCase());
  return JSON.stringify(value);
}

function resultCacheKey(server: string, tool: string, args: Record<string, unknown>): string {
  return `${server}|${tool}|${stableStringify(args)}`;
}

function readResultCache(key: string): ToolCallResult | null {
  const store = resultCache();
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > RESULT_CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function writeResultCache(key: string, value: ToolCallResult) {
  const store = resultCache();
  store.delete(key);
  store.set(key, { at: Date.now(), value });
  while (store.size > RESULT_CACHE_MAX) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

class McpManager {
  private servers = new Map<MarketplaceId, ServerRuntime>();
  private connecting = new Map<MarketplaceId, Promise<void>>();
  private toolIndex = new Map<string, { server: MarketplaceId; tool: string }>();
  private initialized = false;

  constructor() {
    for (const config of getMcpServerConfigs()) {
      this.servers.set(config.id, {
        config,
        client: null,
        transport: null,
        status: "idle",
        tools: [],
        stderr: "",
      });
    }
  }

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    for (const runtime of this.servers.values()) {
      const missing = missingServerFiles(runtime.config);
      if (missing) {
        runtime.status = "offline";
        runtime.error = missing;
      }
    }
  }

  async ensure(id: MarketplaceId, force = false): Promise<boolean> {
    this.ensureInitialized();
    const runtime = this.servers.get(id);
    if (!runtime) return false;
    if (runtime.status === "online" && runtime.client) return true;

    const missing = missingServerFiles(runtime.config);
    if (missing) {
      runtime.status = "offline";
      runtime.error = missing;
      return false;
    }

    if (
      !force &&
      runtime.status === "offline" &&
      runtime.lastAttemptAt &&
      Date.now() - runtime.lastAttemptAt < RETRY_COOLDOWN_MS
    ) {
      return false;
    }

    const existing = this.connecting.get(id);
    if (existing) {
      await existing;
      return runtime.status === "online";
    }

    const promise = this.connect(runtime);
    this.connecting.set(id, promise);
    try {
      await promise;
    } finally {
      this.connecting.delete(id);
    }
    return runtime.status === "online";
  }

  private async connect(runtime: ServerRuntime) {
    await this.disconnect(runtime);
    runtime.status = "connecting";
    runtime.error = undefined;
    runtime.stderr = "";
    runtime.lastAttemptAt = Date.now();
    const started = Date.now();

    const transport = new StdioClientTransport({
      command: runtime.config.command,
      args: runtime.config.args,
      cwd: runtime.config.cwd,
      stderr: "pipe",
      maxBufferSize: 32 * 1024 * 1024,
    });

    transport.stderr?.on("data", (chunk: Buffer | string) => {
      runtime.stderr = (runtime.stderr + chunk.toString()).slice(-5000);
    });

    const client = new Client(
      { name: "bazaar", version: "1.0.0" },
      { capabilities: {} },
    );

    client.onclose = () => {
      if (runtime.client === client) {
        runtime.status = "offline";
        runtime.client = null;
        runtime.transport = null;
      }
    };
    client.onerror = (error) => {
      runtime.error = error.message;
    };

    try {
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout di connessione (${CONNECT_TIMEOUT_MS / 1000}s)`)),
            CONNECT_TIMEOUT_MS,
          ),
        ),
      ]);

      const listed = await Promise.race([
        client.listTools(undefined, { timeout: 20_000 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout nel caricamento dei tool")), 22_000),
        ),
      ]);

      const allowed = new Set(runtime.config.allowedTools);
      runtime.tools = (listed.tools || []).filter((tool) => allowed.has(tool.name));
      runtime.client = client;
      runtime.transport = transport;
      runtime.status = "online";
      runtime.latencyMs = Date.now() - started;
      runtime.connectedAt = Date.now();
      runtime.error = undefined;

      for (const tool of runtime.tools) {
        const existing = this.toolIndex.get(tool.name);
        if (!existing) {
          this.toolIndex.set(tool.name, { server: runtime.config.id, tool: tool.name });
        }
      }
    } catch (error) {
      runtime.status = "offline";
      runtime.error = this.friendlyError(error, runtime.stderr);
      runtime.client = null;
      runtime.transport = null;
      try {
        await client.close();
      } catch {
        // ignore
      }
      try {
        await transport.close();
      } catch {
        // ignore
      }
    }
  }

  private friendlyError(error: unknown, stderr: string): string {
    const message = error instanceof Error ? error.message : String(error);
    const stderrLine = stderr
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-1)[0];
    if (stderrLine && !stderrLine.includes("INFO")) {
      return `${message} — ${stderrLine}`.slice(0, 400);
    }
    return message.slice(0, 400);
  }

  private async disconnect(runtime: ServerRuntime) {
    const client = runtime.client;
    const transport = runtime.transport;
    runtime.client = null;
    runtime.transport = null;
    if (client) {
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
    if (transport) {
      try {
        await transport.close();
      } catch {
        // ignore
      }
    }
  }

  async ensureAll(force = false) {
    this.ensureInitialized();
    await Promise.allSettled(
      Array.from(this.servers.keys()).map((id) => this.ensure(id, force)),
    );
  }

  async reconnectAll() {
    this.ensureInitialized();
    await Promise.allSettled(
      Array.from(this.servers.values()).map(async (runtime) => {
        await this.disconnect(runtime);
        runtime.status = "idle";
        runtime.error = undefined;
        runtime.tools = [];
      }),
    );
    this.toolIndex.clear();
    await this.ensureAll(true);
  }

  async reconnect(id: MarketplaceId) {
    const runtime = this.servers.get(id);
    if (!runtime) return;
    await this.disconnect(runtime);
    runtime.status = "idle";
    runtime.error = undefined;
    runtime.tools = [];
    await this.ensure(id, true);
  }

  getStatus(): McpServerInfo[] {
    this.ensureInitialized();
    return Array.from(this.servers.values()).map((runtime) => ({
      id: runtime.config.id,
      label: runtime.config.label,
      description: runtime.config.description,
      color: runtime.config.color,
      status: runtime.status,
      tools: runtime.tools.map((tool) => tool.name),
      latencyMs: runtime.latencyMs,
      error: runtime.error,
      lastUsed: runtime.lastUsed,
    }));
  }

  getOnlineIds(): MarketplaceId[] {
    return Array.from(this.servers.values())
      .filter((runtime) => runtime.status === "online")
      .map((runtime) => runtime.config.id);
  }

  getOpenAiTools(enabled?: MarketplaceId[]) {
    this.ensureInitialized();
    const allowedServers = new Set(enabled ?? this.getOnlineIds());
    const tools: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }> = [];

    for (const runtime of this.servers.values()) {
      if (runtime.status !== "online") continue;
      if (!allowedServers.has(runtime.config.id)) continue;
      for (const tool of runtime.tools) {
        tools.push({
          type: "function",
          function: {
            name: tool.name,
            description: `[${runtime.config.label}] ${tool.description || tool.name}`,
            parameters: (tool.inputSchema as Record<string, unknown>) || {
              type: "object",
              properties: {},
            },
          },
        });
      }
    }
    return tools;
  }

  resolveTool(name: string): { server: MarketplaceId; tool: string } | null {
    const direct = this.toolIndex.get(name);
    if (direct) return direct;
    for (const runtime of this.servers.values()) {
      if (runtime.tools.some((tool) => tool.name === name)) {
        return { server: runtime.config.id, tool: name };
      }
    }
    return null;
  }

  async callTool(
    server: MarketplaceId,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const key = resultCacheKey(server, tool, args);
    const cached = readResultCache(key);
    if (cached) return { ...cached, durationMs: 0 };
    const result = await this.callToolUncached(server, tool, args);
    // Le risposte vuote non si cachano: spesso sono blocchi temporanei del marketplace.
    if (!result.isError && !/"(?:totale|total)":\s*0\b/.test(result.text)) writeResultCache(key, result);
    return result;
  }

  private async callToolUncached(
    server: MarketplaceId,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const started = Date.now();
    const ok = await this.ensure(server);
    const runtime = this.servers.get(server);
    if (!ok || !runtime?.client) {
      return {
        text: JSON.stringify({
          errore: runtime?.error || `Il server ${server} non è disponibile.`,
        }),
        isError: true,
        durationMs: Date.now() - started,
      };
    }

    const definition = runtime.tools.find((entry) => entry.name === tool);
    const allowedKeys = definition?.inputSchema?.properties
      ? new Set(Object.keys(definition.inputSchema.properties))
      : null;
    const sanitizedArgs = allowedKeys
      ? Object.fromEntries(Object.entries(args).filter(([key]) => allowedKeys.has(key)))
      : args;

    const timeoutMs = runtime.config.toolTimeoutMs;
    const label = runtime.config.label;
    const callArgs = this.prepareArgs(server, tool, sanitizedArgs);

    try {
      let result;
      try {
        result = await runtime.client.callTool(
          { name: tool, arguments: callArgs },
          undefined,
          { timeout: timeoutMs, resetTimeoutOnProgress: false },
        );
      } catch (error) {
        if (!this.isTransportError(error)) throw error;
        // Un solo retry se il processo MCP è caduto: riconnetto e riprovo.
        const reconnected = await this.ensure(server, true);
        if (!reconnected || !runtime.client) throw error;
        result = await runtime.client.callTool(
          { name: tool, arguments: callArgs },
          undefined,
          { timeout: timeoutMs, resetTimeoutOnProgress: false },
        );
      }
      runtime.lastUsed = Date.now();

      const content = Array.isArray(result.content) ? result.content : [];
      const text = content
        .filter(
          (part): part is { type: "text"; text: string } =>
            Boolean(part) && part.type === "text" && typeof part.text === "string",
        )
        .map((part) => part.text)
        .join("\n")
        .trim();

      if (result.isError) {
        return {
          text: text || JSON.stringify({ errore: `Il tool ${tool} ha restituito un errore.` }),
          isError: true,
          durationMs: Date.now() - started,
        };
      }

      if (!text && result.structuredContent) {
        return {
          text: JSON.stringify(result.structuredContent),
          isError: false,
          durationMs: Date.now() - started,
        };
      }

      return {
        text: text || JSON.stringify({ errore: "Risposta vuota dal marketplace." }),
        isError: !text,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      if (this.isTimeoutError(error)) {
        // Il server è probabilmente bloccato (es. rate limiter interno): lo riavvio in background
        // così la prossima ricerca non resta in coda dietro quella appena scaduta.
        void this.recycle(runtime);
        return {
          text: JSON.stringify({
            errore: `${label} non ha risposto entro ${Math.round(timeoutMs / 1000)} s: nessun risultato da questa fonte, riprova più tardi o usa le altre.`,
          }),
          isError: true,
          durationMs: Date.now() - started,
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        text: JSON.stringify({ errore: `${tool}: ${message}` }),
        isError: true,
        durationMs: Date.now() - started,
      };
    }
  }

  /** Alcuni server restituiscono pagine non pertinenti: ne chiedo di più e filtro in normalize. */
  private prepareArgs(
    server: MarketplaceId,
    tool: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    if (server === "amazon" && tool === "search_amazon") {
      const limit = Number(args.limit);
      const wanted = Number.isFinite(limit) ? limit : 8;
      return { ...args, limit: Math.min(30, Math.max(wanted * 3, 20)) };
    }
    return args;
  }

  private isTimeoutError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /timed out|timeout/i.test(message) || (error as { code?: number })?.code === -32001;
  }

  private isTransportError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /connection closed|not connected|EPIPE|transport/i.test(message) && !this.isTimeoutError(error);
  }

  private async recycle(runtime: ServerRuntime) {
    await this.disconnect(runtime);
    runtime.status = "idle";
    runtime.error = undefined;
  }

  async closeAll() {
    await Promise.allSettled(
      Array.from(this.servers.values()).map((runtime) => this.disconnect(runtime)),
    );
    this.servers.clear();
    this.toolIndex.clear();
  }
}

const globalForMcp = globalThis as unknown as {
  __bazaarMcpManager?: McpManager;
};

export function getMcpManager(): McpManager {
  if (!globalForMcp.__bazaarMcpManager) {
    globalForMcp.__bazaarMcpManager = new McpManager();
  }
  return globalForMcp.__bazaarMcpManager;
}

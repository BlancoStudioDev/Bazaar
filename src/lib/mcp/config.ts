import { TOOL_LABELS } from "@/lib/brand/phrases";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { MARKETPLACES } from "@/lib/marketplaces";
import type { MarketplaceId } from "@/lib/types";

export interface McpServerConfig {
  id: MarketplaceId;
  label: string;
  description: string;
  color: string;
  command: string;
  args: string[];
  cwd: string;
  allowedTools: string[];
  /** Timeout massimo di una singola chiamata tool (ms). */
  toolTimeoutMs: number;
  /** Variabili d'ambiente extra per il processo del server (si aggiungono a quelle di default dell'SDK). */
  env?: Record<string, string>;
}

const DEFAULT_TOOL_TIMEOUT_MS = Number(process.env.MCP_TOOL_TIMEOUT_MS) || 20_000;
// Facebook fa più richieste GraphQL e ha un rate limiter interno: se oltre 28 s è bloccato.
const FACEBOOK_TOOL_TIMEOUT_MS = Number(process.env.MCP_TOOL_TIMEOUT_FACEBOOK_MS) || 28_000;

const MCP_ROOT = (process.env.MCP_ROOT || path.join(os.homedir(), ".config", "opencode", "mcp")).replace(
  /^~(?=$|\/)/,
  os.homedir(),
);

const SHARED_PYTHON =
  process.env.MCP_PYTHON_SHARED || path.join(MCP_ROOT, ".venv", "bin", "python");
const SUBITO_PYTHON =
  process.env.MCP_PYTHON_SUBITO || path.join(MCP_ROOT, "subito-search", ".venv", "bin", "python");
const FACEBOOK_PYTHON =
  process.env.MCP_PYTHON_FACEBOOK ||
  path.join(MCP_ROOT, "facebook-marketplace", ".venv", "bin", "python");

function server(
  id: MarketplaceId,
  python: string,
  dir: string,
  allowedTools: string[],
  toolTimeoutMs = DEFAULT_TOOL_TIMEOUT_MS,
  env?: Record<string, string>,
): McpServerConfig {
  const cwd = path.join(MCP_ROOT, dir);
  return {
    id,
    label: MARKETPLACES[id].label,
    description: MARKETPLACES[id].description,
    color: MARKETPLACES[id].color,
    command: python,
    args: [path.join(cwd, "server.py")],
    cwd,
    allowedTools,
    toolTimeoutMs,
    ...(env && Object.keys(env).length ? { env } : {}),
  };
}

/** Chiave trawl.dev (gratuita su https://trawl.dev/signup): senza, il server eBay risponde con un errore esplicito. */
function ebayEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["TRAWL_API_KEY"]) {
    const value = process.env[key];
    if (value) out[key] = value;
  }
  return out;
}

/**
 * Modalità guest di Facebook (nessun cookie/account): FB_GUEST=1, e FB_PROXY per far uscire le richieste
 * da un IP residenziale (Facebook blocca i datacenter). Si passano solo queste due variabili.
 */
function facebookEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["FB_GUEST", "FB_PROXY"]) {
    const value = process.env[key];
    if (value) out[key] = value;
  }
  return out;
}

export function getMcpServerConfigs(): McpServerConfig[] {
  const disabled = new Set(
    (process.env.MCP_DISABLED || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  const configs: McpServerConfig[] = [
    server("amazon", SHARED_PYTHON, "amazon", ["search_amazon", "get_product"]),
    server("ebay", SHARED_PYTHON, "ebay", ["search_ebay", "get_ebay_item"], DEFAULT_TOOL_TIMEOUT_MS, ebayEnv()),
    server("aliexpress", SHARED_PYTHON, "aliexpress", ["search_aliexpress"]),
    server("vinted", SHARED_PYTHON, "vinted", ["search_vinted", "get_item"]),
    server("subito", SUBITO_PYTHON, "subito-search", ["search_subito"]),
    server("facebook-marketplace", FACEBOOK_PYTHON, "facebook-marketplace", [
      "search_marketplace",
      "get_listing",
      "search_location",
    ], FACEBOOK_TOOL_TIMEOUT_MS, facebookEnv()),
  ];

  return configs.filter((config) => !disabled.has(config.id));
}

export function missingServerFiles(config: McpServerConfig): string | null {
  if (!existsSync(config.command)) return `Python non trovato: ${config.command}`;
  if (!existsSync(config.args[0])) return `Server non trovato: ${config.args[0]}`;
  return null;
}

export function toolLabel(server: string, tool: string): string {
  return TOOL_LABELS[tool] || `${server} · ${tool}`;
}

export function isSearchTool(tool: string): boolean {
  return tool.startsWith("search_");
}

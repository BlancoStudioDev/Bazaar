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
}

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
  };
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
    server("aliexpress", SHARED_PYTHON, "aliexpress", ["search_aliexpress"]),
    server("vinted", SHARED_PYTHON, "vinted", ["search_vinted", "get_item"]),
    server("subito", SUBITO_PYTHON, "subito-search", ["search_subito"]),
    server("facebook-marketplace", FACEBOOK_PYTHON, "facebook-marketplace", [
      "search_marketplace",
      "get_listing",
      "search_location",
    ]),
  ];

  return configs.filter((config) => !disabled.has(config.id));
}

export function missingServerFiles(config: McpServerConfig): string | null {
  if (!existsSync(config.command)) return `Python non trovato: ${config.command}`;
  if (!existsSync(config.args[0])) return `Server non trovato: ${config.args[0]}`;
  return null;
}

export function toolLabel(server: string, tool: string): string {
  const labels: Record<string, string> = {
    search_amazon: "Cerco su Amazon",
    get_product: "Apro la scheda Amazon",
    search_aliexpress: "Cerco su AliExpress",
    search_vinted: "Cerco su Vinted",
    get_item: "Apro l'annuncio Vinted",
    search_subito: "Cerco su Subito",
    search_marketplace: "Cerco su Facebook Marketplace",
    get_listing: "Apro l'annuncio Facebook",
    search_location: "Cerco la località",
  };
  return labels[tool] || `${server} · ${tool}`;
}

export function isSearchTool(tool: string): boolean {
  return tool.startsWith("search_");
}

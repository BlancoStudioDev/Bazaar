import { requireUser } from "@/lib/auth/session";
import { getMcpManager } from "@/lib/mcp/manager";
import { fetchOpenRouterKeyInfo } from "@/lib/openrouter/models";
import { getActiveDirectProviders, providerModelName } from "@/lib/openrouter/providers";
import type { MarketplaceId } from "@/lib/types";

export const maxDuration = 90;

async function buildStatus() {
  const manager = getMcpManager();
  await manager.ensureAll();
  const [openrouter, mcp] = await Promise.all([
    fetchOpenRouterKeyInfo(),
    Promise.resolve(manager.getStatus()),
  ]);
  return {
    openrouter,
    providers: getActiveDirectProviders().map((p) => ({ id: p.id, label: p.label, model: providerModelName(p) })),
    mcp,
    checkedAt: Date.now(),
  };
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;

  const status = await buildStatus();
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;

  let body: { action?: string; server?: MarketplaceId } = {};
  try {
    body = (await request.json()) as { action?: string; server?: MarketplaceId };
  } catch {
    // ignore
  }

  const manager = getMcpManager();
  if (body.action === "reconnect") {
    if (body.server) {
      await manager.reconnect(body.server);
    } else {
      await manager.reconnectAll();
    }
  }

  const status = await buildStatus();
  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

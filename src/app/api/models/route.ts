import { requireUser } from "@/lib/auth/session";
import { describeModelForClient, paidFallbackAvailable } from "@/lib/agent/run";
import { getCheapTier, getModelRegistry, getPaidFallbackModel } from "@/lib/openrouter/models";

export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  const registry = await getModelRegistry(force);

  return Response.json(
    {
      ...registry,
      selected: registry.selected ? describeModelForClient(registry.selected) : null,
      models: registry.models.map(describeModelForClient),
      routerModel: registry.routerModel ? describeModelForClient(registry.routerModel) : null,
      cheapModels: (registry.cheapModels || []).map(describeModelForClient),
      paidFallbackAvailable: paidFallbackAvailable(),
      paidFallbackModel: paidFallbackAvailable()
        ? (getCheapTier(registry)[0] ?? getPaidFallbackModel())
        : null,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

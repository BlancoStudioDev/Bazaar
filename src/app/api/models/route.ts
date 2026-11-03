import { describeModelForClient, paidFallbackAvailable } from "@/lib/agent/run";
import { getModelRegistry, getPaidFallbackModel } from "@/lib/openrouter/models";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";
  const registry = await getModelRegistry(force);

  return Response.json(
    {
      ...registry,
      selected: registry.selected ? describeModelForClient(registry.selected) : null,
      models: registry.models.map(describeModelForClient),
      routerModel: registry.routerModel ? describeModelForClient(registry.routerModel) : null,
      paidFallbackAvailable: paidFallbackAvailable(),
      paidFallbackModel: paidFallbackAvailable() ? getPaidFallbackModel() : null,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

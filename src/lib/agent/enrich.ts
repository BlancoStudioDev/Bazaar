import { getMcpManager } from "@/lib/mcp/manager";
import {
  MAX_ITEMS_FOR_MODEL,
  cleanDescription,
  descriptionFromDetail,
  normalizeToolOutput,
  type ToolOutput,
} from "@/lib/mcp/normalize";
import type { MarketplaceId } from "@/lib/types";

/** Candidati con descrizione per marketplace (quelli che il modello userà per verificare i vincoli). */
const PER_SERVER = 4;
/** Chiamate di dettaglio totali per richiesta. */
const MAX_DETAIL_CALLS = 10;
const DETAIL_TIMEOUT_MS = 8_000;
const DESCRIPTION_CHARS = 300;

type Row = Record<string, unknown>;

export interface SearchExecution {
  server: MarketplaceId;
  tool: string;
  output: ToolOutput;
  ok: boolean;
}

function rowsOf(output: ToolOutput): Row[] {
  const data = output.data as Record<string, unknown> | null;
  if (!data) return [];
  const key = ["risultati", "annunci", "items", "listings"].find((k) => Array.isArray(data[k]));
  return key ? (data[key] as Row[]).filter((r) => r && typeof r === "object") : [];
}

function priceOf(row: Row): number {
  const value = typeof row.prezzo_num === "number" ? row.prezzo_num : typeof row.prezzo === "number" ? row.prezzo : NaN;
  return Number.isFinite(value) && value > 0 ? value : Number.POSITIVE_INFINITY;
}

/**
 * Arricchisce i migliori candidati (i più economici tra quelli mostrati al modello) con la descrizione
 * dell'annuncio: da quella già presente nella ricerca (Subito) o con il tool di dettaglio del server.
 * Generico: non conosce categorie né parole chiave. Tollerante agli errori e ai timeout.
 * Modifica le righe in `output.data` e `product.extra`; restituisce quanti prodotti sono cambiati.
 */
export async function enrichWithDescriptions(executions: SearchExecution[], signal?: AbortSignal): Promise<number> {
  const manager = getMcpManager();
  type Job = { exec: SearchExecution; row: Row; productId: string; detailTool: { name: string; param: string; json: boolean } };
  const jobs: Job[] = [];
  let changed = 0;

  const detailToolFor = (server: MarketplaceId) => {
    const tool = manager
      .getOpenAiTools([server])
      .find((entry) => entry.function.name.startsWith("get_"));
    if (!tool) return null;
    const params = (tool.function.parameters?.properties || {}) as Record<string, unknown>;
    const required = (tool.function.parameters?.required as string[] | undefined) || [];
    const param = required[0] || Object.keys(params).find((key) => key !== "format");
    return param ? { name: tool.function.name, param, json: "format" in params } : null;
  };

  const queue: Array<Job[]> = [];
  for (const exec of executions) {
    if (!exec.ok) continue;
    const rows = rowsOf(exec.output);
    const shown = new Set(rows.slice(0, MAX_ITEMS_FOR_MODEL));
    const candidates = rows
      .filter((row) => shown.has(row))
      .sort((a, b) => priceOf(a) - priceOf(b))
      .slice(0, PER_SERVER);
    const detail = detailToolFor(exec.server);
    const serverJobs: Job[] = [];
    for (const row of rows) {
      if (!candidates.includes(row)) {
        delete row.descrizione; // niente descrizioni fuori dai candidati: il modello non le riceve
        continue;
      }
      const inline = cleanDescription(row.descrizione, DESCRIPTION_CHARS);
      const product = exec.output.products.find((p) => p.url === row.url);
      if (inline) {
        row.descrizione = inline;
        if (product) {
          product.extra = [product.extra, inline].filter(Boolean).join(" · ");
          changed += 1;
        }
      } else if (detail && product) {
        serverJobs.push({ exec, row, productId: product.id, detailTool: detail });
      }
    }
    queue.push(serverJobs);
  }

  // Un giro per marketplace alla volta, così il tetto globale non esclude sempre gli stessi.
  for (let i = 0; jobs.length < MAX_DETAIL_CALLS; i += 1) {
    let any = false;
    for (const serverJobs of queue) {
      if (serverJobs[i] && jobs.length < MAX_DETAIL_CALLS) {
        jobs.push(serverJobs[i]);
        any = true;
      }
    }
    if (!any) break;
  }

  await Promise.all(
    jobs.map(async (job) => {
      if (signal?.aborted) return;
      try {
        const args: Record<string, unknown> = { [job.detailTool.param]: job.productId };
        if (job.detailTool.json) args.format = "json";
        const raw = await Promise.race([
          manager.callTool(job.exec.server, job.detailTool.name, args),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), DETAIL_TIMEOUT_MS)),
        ]);
        if (!raw || raw.isError) return;
        const detail = normalizeToolOutput(job.exec.server, job.detailTool.name, raw.text);
        const description = descriptionFromDetail(detail.data, DESCRIPTION_CHARS);
        if (!description) return;
        job.row.descrizione = description;
        const product = job.exec.output.products.find((p) => p.url === job.row.url);
        if (product) {
          product.extra = [product.extra, description].filter(Boolean).join(" · ");
          changed += 1;
        }
      } catch {
        // il dettaglio è un di più: gli errori non devono fermare la risposta
      }
    }),
  );
  return changed;
}

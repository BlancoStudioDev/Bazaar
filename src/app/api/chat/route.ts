import { runAgent } from "@/lib/agent/run";
import { OpenRouterError } from "@/lib/openrouter/models";
import type { AgentEvent, ChatRequestBody } from "@/lib/types";

export const maxDuration = 300;

function sse(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "Nessun messaggio nella richiesta." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          closed = true;
        }
      };

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15_000);

      const finish = () => {
        if (heartbeat) clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      runAgent({ body, signal: request.signal, emit: send })
        .catch((error: unknown) => {
          if (request.signal.aborted) return;
          if (error instanceof OpenRouterError) {
            send({ type: "error", message: error.message, code: String(error.status) });
            return;
          }
          const message =
            error instanceof Error ? error.message : "Errore inatteso durante la ricerca.";
          send({ type: "error", message });
        })
        .finally(finish);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

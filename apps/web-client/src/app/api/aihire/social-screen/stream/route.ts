import {
  getSocialScreenRunManifest,
  readSocialScreenRunEvents,
  resolveSocialScreenRunAlias,
} from "@/server/aihire/social-screen-run-store";
import type { SocialScreenStreamEvent } from "@/server/aihire/social-screen/types";

const encoder = new TextEncoder();

function sseFrame(event: string, id: string, data: unknown): Uint8Array {
  return encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runIdParam = url.searchParams.get("runId")?.trim();
  const candidate = url.searchParams.get("candidate")?.trim() ?? undefined;
  const lastEventId = request.headers.get("last-event-id")?.trim();
  const lastSeenId = Number.parseInt(lastEventId ?? "", 10);

  if (!runIdParam) {
    return Response.json({ ok: false, error: "Missing required query param: runId" }, { status: 400 });
  }

  const resolved = resolveSocialScreenRunAlias(runIdParam, candidate);
  if (!resolved.runId) {
    return Response.json(
      { ok: false, error: resolved.error ?? "Run not found", candidate },
      { status: 404 },
    );
  }
  const runId = resolved.runId;

  const manifest = getSocialScreenRunManifest(runId);
  if (!manifest) {
    return Response.json(
      { ok: false, error: resolved.error ?? "Run not found", candidate },
      { status: 404 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | null = null;
      let pingInterval: ReturnType<typeof setInterval> | null = null;
      let currentEventId = Number.isFinite(lastSeenId) ? lastSeenId : 0;

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (pingInterval) clearInterval(pingInterval);
        try {
          controller.close();
        } catch {
          // ignore close races
        }
      };

      const pump = () => {
        if (closed) return;
        const latestManifest = getSocialScreenRunManifest(runId);
        if (!latestManifest) {
          const event: SocialScreenStreamEvent = {
            type: "error",
            eventId: String(currentEventId + 1),
            timestampISO: new Date().toISOString(),
            message: "Run manifest disappeared.",
            stage: "capture",
          };
          controller.enqueue(sseFrame("error", event.eventId, event));
          close();
          return;
        }

        const events = readSocialScreenRunEvents(runId);
        for (const event of events) {
          const numericId = Number.parseInt(event.eventId, 10);
          if (Number.isNaN(numericId) || numericId <= currentEventId) continue;
          controller.enqueue(sseFrame(event.type, event.eventId, event));
          currentEventId = numericId;
        }

        if (latestManifest.status === "completed" || latestManifest.status === "failed") {
          close();
        }
      };

      controller.enqueue(
        sseFrame("status", "bootstrap", {
          runId,
          status: manifest.status,
          startedAtISO: manifest.startedAtISO,
        }),
      );

      pump();
      interval = setInterval(pump, 500);
      pingInterval = setInterval(() => {
        if (closed) return;
        controller.enqueue(
          sseFrame("ping", `ping-${Date.now()}`, {
            type: "ping",
            eventId: `ping-${Date.now()}`,
            timestampISO: new Date().toISOString(),
            message: "heartbeat",
            data: { nowISO: new Date().toISOString() },
          }),
        );
      }, 15000);
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      // no-op, handled by abort/close path
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

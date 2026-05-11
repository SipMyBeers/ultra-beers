import { buildInbox } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 30_000;

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          // controller may be closed
        }
      };

      let lastIds = new Set<string>();

      const scan = async () => {
        if (abort.signal.aborted) return;
        try {
          const inbox = await buildInbox();
          const currentIds = new Set(inbox.items.map((i) => i.id));
          const added = inbox.items.filter((i) => !lastIds.has(i.id));
          const removedIds = [...lastIds].filter((id) => !currentIds.has(id));
          send("snapshot", inbox);
          if (lastIds.size > 0 && (added.length > 0 || removedIds.length > 0)) {
            send("delta", {
              added: added.map((i) => i.id),
              removed: removedIds,
              addedItems: added,
            });
          }
          lastIds = currentIds;
        } catch (err) {
          send("error", { message: (err as Error).message });
        }
      };

      await scan();
      const heartbeat = setInterval(
        () => send("heartbeat", { at: Date.now() }),
        10_000,
      );
      const interval = setInterval(scan, POLL_INTERVAL_MS);

      abort.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

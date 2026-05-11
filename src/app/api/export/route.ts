import { listPlans } from "@/lib/plans";
import { listDecisions } from "@/lib/decisions";
import { readRegistry } from "@/lib/peers";
import { buildInbox } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NDJSON export — one record per line, type-tagged. Designed for RAG
// ingestion pipelines and agent context loaders. Stable enough to grep,
// pipe to jq, or split by `type` for downstream indexing.
//
// Usage:
//   curl -s http://localhost:4747/api/export
//   curl -s http://localhost:4747/api/export?include=plans,decisions
//   curl -s http://localhost:4747/api/export | jq 'select(.type=="decision")'
export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeParam = url.searchParams.get("include");
  const sinceParam = url.searchParams.get("since");
  const include = includeParam
    ? new Set(includeParam.split(",").map((s) => s.trim().toLowerCase()))
    : new Set(["plans", "decisions", "peers", "inbox"]);
  const sinceMs = sinceParam ? Number(sinceParam) : 0;
  const since = Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const writeLine = (type: string, payload: Record<string, unknown>) => {
        const line = JSON.stringify({ type, ...payload }) + "\n";
        controller.enqueue(encoder.encode(line));
      };

      try {
        if (include.has("plans")) {
          for (const plan of await listPlans()) {
            if (since && plan.updatedAt <= since) continue;
            writeLine("plan", {
              id: plan.id,
              title: plan.title,
              cwd: plan.cwd,
              content: plan.content,
              updatedAt: plan.updatedAt,
            });
          }
        }

        if (include.has("decisions")) {
          for (const decision of await listDecisions()) {
            if (
              since &&
              (decision.decidedAt ?? decision.createdAt) <= since
            ) {
              continue;
            }
            writeLine("decision", {
              id: decision.id,
              title: decision.title,
              status: decision.status,
              context: decision.context,
              options: decision.options,
              chosenId: decision.chosenId,
              note: decision.note,
              createdAt: decision.createdAt,
              decidedAt: decision.decidedAt,
            });
          }
        }

        if (include.has("peers")) {
          const registry = await readRegistry();
          for (const peer of registry.peers) {
            writeLine("peer", {
              id: peer.id,
              label: peer.label,
              summary: peer.summary,
              cwd: peer.cwd,
              lastSeen: peer.lastSeen,
              color: peer.color,
            });
          }
        }

        if (include.has("inbox")) {
          const inbox = await buildInbox();
          for (const item of inbox.items) {
            writeLine("inbox_item", {
              id: item.id,
              repoId: item.repoId,
              repoName: item.repoName,
              repoSlug: item.repoSlug,
              repoLastCommitAgeSeconds: item.repoLastCommitAgeSeconds,
              source: item.point.source,
              pointType: item.point.type,
              text: item.point.text,
              context: item.point.context,
              lineNumber: item.point.lineNumber,
            });
          }
        }
      } catch (err) {
        writeLine("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

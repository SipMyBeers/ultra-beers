import { ROLES, type AgentEvent, type AgentRole } from "@/lib/agent-types";
import { spawnAgent } from "@/lib/agents";
import { expandCwd, validateCwd } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    plan?: string;
    roles?: AgentRole[];
    cwd?: string;
  };
  const plan = typeof body.plan === "string" ? body.plan : "";
  const roles = Array.isArray(body.roles) && body.roles.length > 0 ? body.roles : ROLES;

  if (!plan.trim()) {
    return new Response(JSON.stringify({ error: "empty plan" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let resolvedCwd: string | undefined;
  if (body.cwd) {
    resolvedCwd = expandCwd(body.cwd);
    if (resolvedCwd) {
      const check = await validateCwd(resolvedCwd);
      if (!check.ok) {
        return new Response(
          JSON.stringify({ error: `cwd ${check.reason}: ${resolvedCwd}` }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
    }
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        const line = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      if (resolvedCwd) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "cwd", cwd: resolvedCwd })}\n\n`),
        );
      }

      await Promise.all(
        roles.map((role) =>
          spawnAgent(role, plan, send, abort.signal, { cwd: resolvedCwd }).catch(
            (err: unknown) => {
              send({
                type: "error",
                role,
                message: err instanceof Error ? err.message : String(err),
              });
            },
          ),
        ),
      );

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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

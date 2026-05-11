#!/usr/bin/env node
// ultra-beers-mcp — thin MCP server wrapping the ultra-beers HTTP API.
// Designed for Claude Code sessions that want plans/decisions/inbox as
// native tools. ultra-beers itself stays running on localhost as the
// state + UI layer; this server is the protocol bridge.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.ULTRA_BEERS_URL || `http://localhost:${process.env.ULTRA_BEERS_PORT || 4747}`;

const TOOLS = [
  {
    name: "list_plans",
    description: "List ultra-beers plans (metadata only — id, title, updatedAt).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_plan",
    description: "Read a single ultra-beers plan with its full content + cwd.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Plan id" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_plan",
    description: "Create a new ultra-beers plan. Returns the new plan id.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Initial markdown content (full plan body)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_decisions",
    description: "List ultra-beers decisions (pending + decided + skipped). Lightweight metadata.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_decision",
    description: "Read a single ultra-beers decision with its context and options.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_decision",
    description: "Create a new ultra-beers decision with 2-4 options.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        context: { type: "string" },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["title", "options"],
      additionalProperties: false,
    },
  },
  {
    name: "decide_decision",
    description: "Record a decision: pick one of its option ids, with an optional note.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        chosenId: { type: "string", description: "Option id from the decision's options array, or 'skip'." },
        note: { type: "string" },
      },
      required: ["id", "chosenId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_inbox",
    description: "Fetch the global decision-point inbox aggregated across active repos.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_repos",
    description: "List detected git repos with branch + last-commit metadata.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_repo",
    description:
      "Per-repo deep-dive: commits, README/ROADMAP, decision points, dirty files, linked vault notes.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_peers",
    description: "Fetch the ultra-beers peer registry (last claude-peers snapshot).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "export",
    description:
      "Stream the NDJSON export — every plan/decision/peer/inbox_item type-tagged. Use 'include' to filter.",
    inputSchema: {
      type: "object",
      properties: {
        include: {
          type: "string",
          description: "Comma-separated subset of: plans, decisions, peers, inbox.",
        },
      },
      additionalProperties: false,
    },
  },
];

async function http(method, path, body) {
  const init = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `ultra-beers ${method} ${path} → HTTP ${res.status}: ${typeof parsed === "object" && parsed?.error ? parsed.error : text.slice(0, 200)}`,
    );
  }
  return parsed;
}

async function dispatch(name, args) {
  switch (name) {
    case "list_plans":
      return http("GET", "/api/plans");
    case "read_plan":
      return http("GET", `/api/plans/${encodeURIComponent(args.id)}`);
    case "create_plan":
      return http("POST", "/api/plans", { content: args.content });
    case "list_decisions":
      return http("GET", "/api/decisions");
    case "read_decision":
      return http("GET", `/api/decisions/${encodeURIComponent(args.id)}`);
    case "create_decision":
      return http("POST", "/api/decisions", {
        title: args.title,
        context: args.context ?? "",
        options: args.options,
      });
    case "decide_decision":
      return http("PUT", `/api/decisions/${encodeURIComponent(args.id)}`, {
        action: "decide",
        chosenId: args.chosenId,
        note: args.note,
      });
    case "list_inbox":
      return http("GET", "/api/inbox");
    case "list_repos":
      return http("GET", "/api/repos");
    case "read_repo":
      return http("GET", `/api/repos/${encodeURIComponent(args.id)}`);
    case "list_peers":
      return http("GET", "/api/peers");
    case "export": {
      const include = args?.include ? `?include=${encodeURIComponent(args.include)}` : "";
      const res = await fetch(`${BASE}/api/export${include}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.split("\n").filter(Boolean);
      return {
        recordCount: lines.length,
        records: lines.map((l) => JSON.parse(l)),
      };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: "ultra-beers", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const result = await dispatch(name, args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `ultra-beers-mcp error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

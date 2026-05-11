# Integrations

ultra-beers is a local HTTP service. Anything that speaks HTTP can read or write to it. This document is the contract for RAG pipelines, agent frameworks, scripts, and other workflows that want to plug in.

## Read endpoints (idempotent, no auth)

All read endpoints return JSON. Base URL is `http://localhost:4747` unless `ULTRA_BEERS_PORT` is set.

| Endpoint | Returns | Notes |
|---|---|---|
| `GET /api/plans` | `{ plans: Plan[] }` | Plan metadata only, no content |
| `GET /api/plans/:id` | `{ plan: Plan }` | Full plan with content |
| `GET /api/decisions` | `{ decisions: Decision[] }` | Includes pending + decided + skipped |
| `GET /api/decisions/:id` | `{ decision: Decision }` | Full decision with options |
| `GET /api/peers` | `{ peers, syncedAt }` | Peer registry — claude-peers snapshot |
| `GET /api/vault?vault=<id>` | `{ vault, entries }` | Vault tree |
| `GET /api/vault?vault=<id>&path=<rel>` | `{ file }` | Vault file contents |
| `GET /api/repos` | `{ repos: Repo[] }` | Detected git repos with branch/commit metadata |
| `GET /api/repos/:id` | `{ overview: RepoOverview }` | Per-repo aggregate: commits, README/ROADMAP, decision points, vault links |
| `GET /api/repos/:id/issues` | `{ issues: RepoIssue[] }` | Open GitHub issues via `gh` |
| `GET /api/inbox` | `InboxSummary` | Aggregated decision points across active repos |
| `GET /api/inbox/stream` | SSE | Live inbox stream (snapshot + delta events) |
| `GET /api/export` | NDJSON | All entities, type-tagged, for RAG ingestion |

## Bulk export — `GET /api/export`

NDJSON, one record per line. Each record has a `type` field. Suitable for piping into vector DBs, embedding pipelines, or any agent that needs a snapshot of your ultra-beers state.

```bash
curl -s http://localhost:4747/api/export | head -3
# {"type":"plan","id":"20260510-…","title":"…",…}
# {"type":"decision","id":"…","title":"…",…}
# {"type":"inbox_item","id":"…","repoName":"gormers",…}

curl -s http://localhost:4747/api/export | jq -c 'select(.type=="decision")'
curl -s "http://localhost:4747/api/export?include=plans,decisions"
```

Supported `include` values: `plans`, `decisions`, `peers`, `inbox`. Default is all four.

### Incremental sync — `?since=<ms>`

Pass a millisecond unix timestamp to get only records updated since that time. Useful for cron-style RAG pipelines that need deltas, not full snapshots.

```bash
# Initial snapshot, save the wall-clock timestamp
NOW=$(node -e 'process.stdout.write(String(Date.now()))')
curl -s http://localhost:4747/api/export > snapshot.ndjson

# An hour later, only fetch changes since then
curl -s "http://localhost:4747/api/export?since=$NOW" > delta.ndjson
```

Filtering is applied to `plans` (by `updatedAt`) and `decisions` (by `decidedAt` if set, else `createdAt`). `peers` and `inbox` are always full snapshots — they're regenerated on every request and there's no canonical "last modified" timestamp on the items themselves.

## Live stream — `GET /api/inbox/stream`

Server-Sent Events. Re-scans the active repo set every 30 seconds and emits:

- `event: snapshot` — full `InboxSummary` payload (sent on connect and on each scan)
- `event: delta` — `{ added: string[], removed: string[], addedItems: InboxItem[] }`
- `event: heartbeat` — `{ at: <ms> }` every 10s
- `event: error` — scan failure with message

```bash
curl -N http://localhost:4747/api/inbox/stream
```

In JS:

```js
const es = new EventSource("http://localhost:4747/api/inbox/stream");
es.addEventListener("snapshot", (e) => console.log(JSON.parse(e.data)));
es.addEventListener("delta", (e) => console.log("changes:", JSON.parse(e.data)));
```

## Write endpoints

Same JSON shape both ways. No auth — it's a local single-user tool.

```bash
# Create a plan
curl -s -X POST http://localhost:4747/api/plans \
  -H "content-type: application/json" \
  -d '{"content":"# my plan\n\n1. step\n"}'

# Refine a plan (streams 3 agent critiques)
curl -sN -X POST http://localhost:4747/api/refine \
  -H "content-type: application/json" \
  -d '{"plan":"# my plan…","cwd":"/path/to/repo"}'

# Create a decision
curl -s -X POST http://localhost:4747/api/decisions \
  -H "content-type: application/json" \
  -d '{
    "title": "Pick a database",
    "context": "We need to choose…",
    "options": [
      {"id":"postgres","label":"Postgres"},
      {"id":"sqlite","label":"SQLite"}
    ]
  }'

# Decide it
curl -s -X PUT http://localhost:4747/api/decisions/<id> \
  -H "content-type: application/json" \
  -d '{"action":"decide","chosenId":"postgres","note":"familiar tooling"}'

# Sync peer roster from claude-peers MCP
curl -s -X POST http://localhost:4747/api/peers \
  -H "content-type: application/json" \
  -d '{"action":"sync","peers":[{"id":"abc","label":"X","summary":"…"}]}'
```

## RAG pipelines

### One-shot snapshot

```bash
curl -s http://localhost:4747/api/export > snapshot.ndjson
```

Feed `snapshot.ndjson` into your embedder. Each line is an independent record with a stable `id` and a meaningful `text` body to embed. Suggested field selection:

- `plan` — embed `title + content`, store id + updatedAt
- `decision` — embed `title + context + options[].label`, store status + chosenId
- `inbox_item` — embed `text + context`, store repoName + source + lineNumber
- `peer` — embed `label + summary`

### Continuous sync

Poll `/api/export` on a cron, or for fresher data, subscribe to `/api/inbox/stream` for new decision points. Combine: snapshot once for backfill, then stream for deltas.

### Filtering by type

The `include` parameter lets you bound the snapshot:

```bash
# Only decision-shaped records
curl -s "http://localhost:4747/api/export?include=decisions,inbox" \
  > decisions.ndjson
```

## Agent integration

Two patterns work well:

### Pattern 1 — read-only context loader

An agent fetches `/api/inbox` at session start to know what calls the user has pending, or `/api/repos/:id` for a specific project. Treat the response as ambient context. No tool calls needed beyond `fetch`.

### Pattern 2 — read + write tool

Expose ultra-beers' read endpoints as tools (e.g., `ultra_beers_list_decisions`, `ultra_beers_read_plan`) and the write endpoints (`ultra_beers_create_decision`, `ultra_beers_decide`) so the agent can record outcomes. The included `/ultrabeers` and `/ultrabridge` slash commands are reference implementations of this pattern.

### MCP server

ultra-beers does not ship an MCP server itself — building one is a thin wrapper around the HTTP endpoints. Skeleton:

```ts
// pseudo
server.tool("list_decisions", async () => {
  const r = await fetch("http://localhost:4747/api/decisions");
  return await r.json();
});
server.tool("create_plan", async ({ content }) => {
  const r = await fetch("http://localhost:4747/api/plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return await r.json();
});
```

Submit yours via PR if you want it linked here.

## Schemas (TypeScript)

The source-of-truth types live in `src/lib/*.ts`:

- `Plan` → `src/lib/plans.ts`
- `Decision` + `DecisionOption` → `src/lib/decisions.ts`
- `Peer` → `src/lib/peers.ts`
- `Repo`, `RepoIssue`, `RepoOverview`, `DecisionPoint` → `src/lib/repos.ts`
- `InboxItem`, `InboxSummary` → `src/lib/inbox.ts`
- `VaultEntry` → `src/lib/vault.ts`

For non-TS consumers, the JSON responses are stable — copy a sample and use it as a schema.

## Integrating with existing Claude Code skills

If you already have skills under `~/.claude/skills/<skill-name>/SKILL.md`, you can make them ultra-beers-aware without rewriting them. ultra-beers is just localhost HTTP.

### Pattern 1 — skill reads project state before acting

Add a single bash step at the top of the skill body:

```markdown
1. Pull current context:
   ```bash
   curl -s http://localhost:4747/api/repos/<repo-id> | jq '.overview'
   curl -s http://localhost:4747/api/inbox | jq '.items[] | select(.repoId=="<repo-id>")'
   ```
2. Use the returned roadmap / decision points to inform the next steps.
```

This works for any skill that does scoped repo work — code review, audit, refactor, release-prep. The skill now sees what's pending in ultra-beers' view of the project, not just the current diff.

### Pattern 2 — skill records its outcome as a decision or plan

When a skill finishes a stage that needed a human call, record it so the state survives the session:

```bash
curl -s -X POST http://localhost:4747/api/decisions \
  -H "content-type: application/json" \
  -d '{
    "title": "Reviewed PR #42",
    "context": "Skeptic flagged X and Y. Verifier confirmed Z exists.",
    "options": [
      {"id":"approve","label":"Approve and merge"},
      {"id":"changes","label":"Request changes"},
      {"id":"close","label":"Close — won'\''t do"}
    ]
  }'
```

Now the user can land on `/decisions`, see your skill's output as a card, and click their call.

### Pattern 3 — skill subscribes to the live inbox

For a skill that babysits a long-running process:

```bash
# in the skill body, run in background or in a loop
curl -sN http://localhost:4747/api/inbox/stream | while IFS= read -r line; do
  case "$line" in
    "event: delta"*) echo "new decision points detected" ;;
  esac
done
```

When the user adds a `## Decision:` heading to a project's ROADMAP, your skill picks it up via the SSE stream and can react (post a message, ping a peer, etc.).

### Pattern 4 — skill consumes the NDJSON export for context

For RAG-flavored skills:

```bash
curl -s http://localhost:4747/api/export?include=decisions,inbox > /tmp/ub-context.ndjson
# feed into your skill's prompt-builder, embedder, or grep pipeline
```

The export is type-tagged, stable across versions, and works without any SDK.

### Wrapping a skill as an MCP tool

If your skill is already wrapped as an MCP tool, ultra-beers' MCP server (see [`mcp/`](mcp/)) gives you a parallel tool surface for plans/decisions/inbox without rewriting either. They compose — your skill keeps doing its job, the ultra-beers MCP keeps state.

## CORS

The Next.js dev server allows same-origin only by default. If you need to call ultra-beers from another origin (e.g., a browser-based RAG playground on a different port), add a reverse proxy or set `next.config.ts` headers — kept off by default to stay local-first.

## Data on disk

If your pipeline can read filesystem directly, all data is plain markdown / JSON:

- Plans: `~/.ultra-beers/plans/<id>.md` (frontmatter + body)
- Decisions: `~/.ultra-beers/decisions/<id>.md` (frontmatter + `## Context` / `## Options` / `## Decision` sections)
- Peers: `~/.ultra-beers/peers.json`
- Config: `~/.ultra-beers/config.json`

The HTTP endpoints are conveniences over these files. You can read or rsync the directory and skip ultra-beers entirely if that suits your stack.

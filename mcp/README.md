# ultra-beers-mcp

Stdio MCP server that exposes ultra-beers' HTTP API as native tools for any Claude Code (or other MCP-capable) session.

ultra-beers itself stays running on `localhost:4747` as the state + UI layer; this server is the protocol bridge so agents don't have to write `curl` invocations by hand.

## Install

```bash
cd ultra-beers/mcp
npm install
```

Or invoke without install via `npx`:

```bash
npx -y --package=$(pwd) ultra-beers-mcp
```

## Register with Claude Code

Add to your project's `.mcp.json` (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "ultra-beers": {
      "command": "node",
      "args": ["/absolute/path/to/ultra-beers/mcp/index.mjs"]
    }
  }
}
```

If ultra-beers is running on a non-default port:

```json
{
  "mcpServers": {
    "ultra-beers": {
      "command": "node",
      "args": ["/absolute/path/to/ultra-beers/mcp/index.mjs"],
      "env": {
        "ULTRA_BEERS_URL": "http://localhost:4848"
      }
    }
  }
}
```

Restart the Claude Code session. The tools below become available with the prefix `mcp__ultra-beers__`.

## Tools

| Tool | Maps to | What it does |
|---|---|---|
| `list_plans` | `GET /api/plans` | List plan metadata |
| `read_plan` | `GET /api/plans/:id` | Read one full plan |
| `create_plan` | `POST /api/plans` | New plan with markdown body |
| `list_decisions` | `GET /api/decisions` | All decisions, including decided |
| `read_decision` | `GET /api/decisions/:id` | One decision with options |
| `create_decision` | `POST /api/decisions` | New decision with 2-8 options |
| `decide_decision` | `PUT /api/decisions/:id` | Pick an option (`chosenId`), optional `note` |
| `list_inbox` | `GET /api/inbox` | Aggregated decision points across active repos |
| `list_repos` | `GET /api/repos` | Detected git repos with branch + last-commit |
| `read_repo` | `GET /api/repos/:id` | Deep-dive: commits, ROADMAP, decision points, vault links |
| `list_peers` | `GET /api/peers` | claude-peers roster |
| `export` | `GET /api/export` | NDJSON dump, `include` filter supported |

All tools require ultra-beers to be running locally. They throw a clear error if it isn't.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `ULTRA_BEERS_URL` | `http://localhost:4747` | Full base URL for the ultra-beers server |
| `ULTRA_BEERS_PORT` | `4747` | Port (only used if `ULTRA_BEERS_URL` is unset) |

## License

MIT.

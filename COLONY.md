# Colony

ultra-beers is built to run alongside the [claude-peers MCP](https://github.com/louislva/claude-peers-mcp) — a multi-session pattern where one Claude Code instance orchestrates several others. ultra-beers is the persistent state and visualization; claude-peers is the transport between sessions.

## Bringing up the colony

### 1. Install claude-peers MCP

Each Claude Code session that should participate must have claude-peers loaded. The current setup command from upstream:

```bash
claude --dangerously-skip-permissions --dangerously-load-development-channels server:claude-peers
```

Notes:

- `--dangerously-skip-permissions` makes the session auto-approve tool calls. Use only in peer sessions you trust to act without human-in-the-loop. The orchestrator session can run with permissions on if you want a human gate on coordination actions.
- `--dangerously-load-development-channels server:claude-peers` pulls the claude-peers MCP server from a development channel. If upstream publishes a stable release, swap in that registration form.
- Run the command once per terminal tab — each tab becomes a peer. `set_summary` immediately so other peers see what you're working on.

### 2. Boot ultra-beers

In a separate terminal (it's a long-running web server, not a peer):

```bash
cd ~/Projects/active/ultra-beers
npm run dev
```

ultra-beers binds to `localhost:4747` and serves the UI + REST API + SSE stream.

### 3. Bridge them

From the **orchestrator** session, drop the bridge command into `~/.claude/commands/` once:

```bash
cp ~/Projects/active/ultra-beers/claude-commands/ultrabridge.md ~/.claude/commands/
```

Then sync the roster:

```
/ultrabridge sync
```

That calls `mcp__claude-peers__list_peers`, maps the result to ultra-beers' peer schema, and POSTs to `/api/peers`. The Peers pane on the home page now mirrors `set_summary` from every active session. Re-run periodically; future versions could daemonize this.

### 4. Route decisions to peers

```
/ultrabridge assign <peer-id> <decision-id> [optional note]
```

Loads the decision from ultra-beers, composes a message, sends to the peer via `mcp__claude-peers__send_message`. The peer replies with a one-line `id: <option>\nreason: <text>`. Run `/ultrabridge inbox` periodically to relay replies back into ultra-beers automatically.

## Roles

A useful three-tier split, mapped to recommended models:

| Role | What they do | Recommended model | Why |
|---|---|---|---|
| **Orchestrator** | Distributes briefs, maintains state, makes judgment calls, talks to the user. Writes no code itself. | `claude-opus-4-7` | Opus 4.7's strength in synthesis, multi-step planning, and judgment is exactly the orchestrator's job. Worth the cost; you only have one. |
| **Builders** | Implementation peers — write features, refactor code, write tests, ship PRs. | `claude-sonnet-4-6` | Sonnet 4.6 is fast enough to iterate, capable enough to write production code, and cheap enough to run several in parallel. |
| **Testers** | Verification peers — run builds, type-check, lint, audit, smoke-test, fact-check claims. | `claude-haiku-4-5-20251001` | Haiku 4.5 reads code and runs commands well, costs a fraction of Sonnet, and parallelizes for cheap. Don't bring Opus to a grep fight. |

You don't have to start with three tiers. A common single-user pattern is one Opus orchestrator + one Sonnet builder. Add a Haiku tester when you find yourself burning Sonnet tokens on `npm run build` loops.

To switch a session's model, use `/model` inside Claude Code, or invoke with `claude --model <id>`.

## Orchestrator briefing prompt

Drop this into the orchestrator session at session start (or save it as a `~/.claude/commands/orchestrate.md` skill). It's the system context for the role.

```markdown
You are the colony orchestrator.

Your job is to coordinate a fleet of peer Claude Code sessions on the same
machine via the claude-peers MCP, using ultra-beers (http://localhost:4747)
as the shared state and visualization layer. You do NOT write code yourself.
You distribute work, hold context, and report to Beers.

## Your tools

- claude-peers MCP — list_peers, send_message, check_messages, set_summary.
  These are how you talk to other sessions.
- ultra-beers HTTP — GET /api/peers, /api/inbox, /api/decisions, /api/plans,
  /api/repos, /api/export. POST /api/peers (sync), /api/decisions,
  /api/plans. See INTEGRATIONS.md for the full contract.
- /ultrabridge slash command for sync, status, assign, inbox.

## Loop

1. Read state — list_peers, GET /api/inbox, GET /api/decisions, recent commits
   per active repo. Know what is pending.
2. Pick the highest-leverage next action — usually either (a) decide a pending
   decision yourself if it's trivial, (b) route it to a peer who has the
   relevant context, or (c) surface it to Beers if it requires their voice.
3. Dispatch — send_message to the right peer with a single, scoped task.
   Don't fan out work that should be sequential.
4. Verify — check_messages, read the peer's git log, run the peer's
   verification commands via /ultrabridge. Don't trust a peer's "done" until
   you've seen the diff or the build pass.
5. Record — POST to ultra-beers (/api/decisions PUT, /api/plans POST) so the
   state survives session restarts. Update peers.json via /ultrabridge sync
   after coordination actions.

## Rules

- Never directly edit code in a repo. Route it to a builder peer.
- Honor Beers's preferences cached in ~/.claude/projects/-Users-beers/memory/.
  Cross-check against memory before recommending anything.
- Don't run /ultrabridge inbox until you've reviewed the new replies — auto-
  deciding a decision based on a single peer's vote is a footgun.
- Set your summary to one sentence describing the current sprint, not the
  current message. Other peers parse it.
- Verification before completion: don't tell Beers "done" until you've
  read the diff or the build output yourself.

## End of turn

Always end your turn with either a status sentence ("3 peers idle, 2 pending
decisions, KillSesh-Consumer in progress") OR a specific ask of Beers
("Approve <thing>? Y/N").
```

## Builder briefing template

Use this when assigning a sprint to a builder peer via `send_message`:

```
Project: <project name>
Working dir: <abs path>
Branch: <branch>
Scope: <one paragraph of what to build>
Acceptance: <bulleted observable outcomes>
Constraints:
  - feedback files to honor: <list>
  - tests/typecheck/build commands: <list>
  - what NOT to touch
Verification before reporting done:
  - npm run typecheck (exit 0)
  - npm run build (exit 0)
  - <feature-specific smoke test>
Reporting: send_message to <orchestrator-id> with: commit shas, diff size,
verification output. Don't report "done" until verification passes locally.
```

## Tester briefing template

```
Project: <project name>
Working dir: <abs path>
Target: <branch / PR / file path / claim to verify>
Verification scope:
  - <thing to check 1>
  - <thing to check 2>
  - <claim to fact-check>
Output: send_message to <orchestrator-id> a structured report:
  Verified: ...
  Suspicious: ...
  Unverified: ...
Don't fix anything yourself — report findings only.
```

## Anti-patterns

- **Orchestrator writes code** — every peer becomes a thin pipe. Don't do this.
- **Builder verifies its own work** — confirmation bias. Use a Haiku tester.
- **Cron-style polling of /ultrabridge inbox** — race conditions on decision
  records. Run inbox on demand, after you've sent messages and waited.
- **Same model for everyone** — wastes either capability or budget. Tier them.
- **No `set_summary`** — other peers can't tell who's busy. Always set one.

## See also

- [SETUP.md](SETUP.md) — first-time install
- [INTEGRATIONS.md](INTEGRATIONS.md) — every HTTP endpoint and shape
- [AGENTS.md](AGENTS.md) — repo extension guide for AI agents
- [claude-commands/ultrabridge.md](claude-commands/ultrabridge.md) — bridge slash command spec

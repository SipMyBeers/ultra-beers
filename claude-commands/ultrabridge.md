---
description: Bridge between ultra-beers (localhost:4747) and the claude-peers MCP. Sync peer roster, route plans/decisions, relay responses.
allowed-tools: Bash(*), mcp__claude-peers__*
---

# /ultrabridge

You are the bridge between two systems:

- **ultra-beers** — a local web app at `http://localhost:4747` with HTTP REST APIs for plans, decisions, and peers. Source at <https://github.com/SipMyBeers/ultra-beers>.
- **claude-peers MCP** — already loaded in this session. Tools: `mcp__claude-peers__list_peers`, `mcp__claude-peers__send_message`, `mcp__claude-peers__check_messages`, `mcp__claude-peers__set_summary`.

The argument controls which subcommand runs. `$ARGUMENTS` is one of:

- `sync` (or empty) — refresh ultra-beers' peer registry from `list_peers`
- `status` — print the current colony roster from ultra-beers
- `assign <peer-id> <decision-id> [note]` — send a decision summary to a peer via `send_message`
- `inbox` — check this session's inbox and post responses back to ultra-beers as plan/decision comments

## Behavior — sync (default)

1. Confirm ultra-beers is reachable: `curl -fsS -o /dev/null --max-time 2 http://localhost:4747/api/peers`. If not, tell the user to start it (`cd ~/Projects/active/ultra-beers && npm run dev`) and stop.
2. Call `mcp__claude-peers__list_peers` with `scope: "machine"`.
3. For each peer returned, derive a `label` from the summary if present (e.g. extract the part before the first period, capped at 30 chars), else fall back to the ID. Skip peers with no `Last seen` in the past 24h unless they have a summary.
4. POST the mapped peer list to `http://localhost:4747/api/peers` with body:
   ```json
   {
     "action": "sync",
     "peers": [
       { "id": "...", "label": "...", "summary": "...", "cwd": "...", "lastSeen": "..." , "pid": 0, "tty": "..." }
     ]
   }
   ```
5. Report a one-line summary of what synced (count, who's new, who's stale).

## Behavior — status

GET `http://localhost:4747/api/peers`. Pretty-print: each peer's `label`, `summary` (truncated at 60 chars), and last-seen relative time. Mark anyone seen >5min ago as stale.

## Behavior — assign <peer-id> <decision-id> [optional note]

1. GET `http://localhost:4747/api/decisions/<decision-id>` to load the decision.
2. Compose a message: title, context (first 400 chars), options as a numbered list, and the optional note. End with: "Reply with the option id you'd pick and a 1-sentence reason. Format: `id: <id>\nreason: <text>`."
3. Call `mcp__claude-peers__send_message` with `to_id: <peer-id>` and the composed body.
4. Confirm the send. (Future: also tag the decision via `/api/decisions/<id>` PUT so the UI shows "routed to peer X" — not implemented yet.)

## Behavior — inbox

1. Call `mcp__claude-peers__check_messages`.
2. For each new message that looks like a decision reply (matches `id:\s*\S+` and `reason:`), parse `id` and `reason`, look up the most-recent matching pending decision, and PUT to `/api/decisions/<dec-id>` with `{action:"decide", chosenId: <id>, note: "<peer-id>: <reason>"}`.
3. Anything else, summarize for the user without auto-acting.

## Constraints

- All HTTP calls use `curl -fsS` and 5s max timeouts; bail and report cleanly on failure.
- Do not auto-decide if the peer's message is ambiguous — surface to the user instead.
- The orchestrator (this session) IS the bridge. ultra-beers cannot call MCP directly; everything flows through this command.

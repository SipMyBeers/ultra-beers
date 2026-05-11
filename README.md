# ultra-beers

**Open-source local plan refinement.** Like `/ultraplan`, but it runs on your machine and dispatches to local Claude Code agents instead of a cloud sandbox.

You write a plan in the editor. You click **refine**. Three local Claude agents — `Skeptic`, `Verifier`, `Tightener` — run in parallel against the plan and stream their critiques back. You merge the good ideas into your plan. Ship.

No API key. No cloud upload. No repo size limit. Your code never leaves the machine.

---

## Why

Anthropic's hosted `/ultraplan` is great but:

- It bundles your repo and sends it to a cloud sandbox — there's a size limit.
- You can't see or change the orchestration prompts.
- It's billed compute on someone else's machine.

If you already have Claude Code installed, you already have the substrate to do this locally. `ultra-beers` is the thin UI and orchestration around it.

## Requirements

- Node.js 20+
- [Claude Code](https://claude.com/claude-code) installed and authenticated (`claude` on your `$PATH`)
- macOS or Linux

## Install

```bash
git clone https://github.com/SipMyBeers/ultra-beers
cd ultra-beers
npm install
npm run dev
```

Open <http://localhost:4747>.

## Usage

1. Click **+ new plan**.
2. Write or paste your plan in the left pane. Markdown.
3. Click **refine with agents**. Three local `claude` processes spin up in parallel:
   - **Skeptic** — finds holes, hidden assumptions, missing dependencies.
   - **Verifier** — fact-checks paths, APIs, references against your actual codebase.
   - **Tightener** — sharpens vague language, removes fluff, adds acceptance criteria.
4. Each agent streams its output into the right-hand panel as it works.
5. Edit your plan with the suggestions you like. Re-run as needed.
6. Done.

Plans are stored as plain markdown at `~/.ultra-beers/plans/<id>.md`. Open them in any editor.

## CLI mode

If you don't want the web UI, pipe a plan to the included shell script. It posts to the running server and streams colored agent output to your terminal — visually distinct from cloud `/ultraplan`'s orange theme (ultra-beers uses cyan + magenta + green).

```bash
# from a heredoc, pointing the agents at your repo
./bin/ub-refine.sh --cwd ~/Projects/your-repo <<'PLAN'
# My plan
1. Add Clerk auth
2. Deploy to Vercel
PLAN

# from a file
./bin/ub-refine.sh --cwd . < plan.md

# as an argument
./bin/ub-refine.sh "Quick plan: do X then Y"
```

## Claude Code slash commands

Two companion slash commands live in [`claude-commands/`](claude-commands/). Copy them to `~/.claude/commands/`:

```bash
cp claude-commands/*.md ~/.claude/commands/
```

- **`/ultrabeers <plan>`** — refines a plan from any Claude Code session and summarizes the three agents' critiques into one patch list.
- **`/ultrabridge`** — bridges ultra-beers to the [claude-peers MCP](https://github.com/louislva/claude-peers-mcp). Subcommands: `sync` (default; refresh peer roster), `status`, `assign <peer-id> <decision-id>`, `inbox` (route peer replies into decisions).

## Colony pairing (claude-peers)

If you run multiple Claude Code sessions on the same machine and have the `claude-peers` MCP server set up, ultra-beers becomes the colony dashboard. The home page renders a `Peers` pane with each peer's `set_summary` and a live/stale dot. The bridging flow:

```
ultra-beers (web UI + REST API)   ←HTTP→   orchestrator session   ←MCP→   peers
```

ultra-beers can't call MCP tools directly (it's a Next.js server, not a Claude Code session), so the orchestrator runs `/ultrabridge sync` to refresh the registry, `/ultrabridge assign` to route a decision to a peer, and `/ultrabridge inbox` to relay replies back. Peer registry persists at `~/.ultra-beers/peers.json`.

## How it works

The Next.js API route `POST /api/refine` spawns `claude -p "<role prompt>" --output-format stream-json` once per role. Each process is a separate Claude Code session with full agent capabilities (tool use, file reading, MCP servers — whatever your default `claude` setup has). The route parses the streaming JSON output and forwards text deltas over Server-Sent Events to the browser.

Because each agent is a real Claude Code instance, the **Verifier** can actually grep your filesystem to check claimed paths exist. The Skeptic and Tightener can too, but the prompts steer them toward analysis instead of investigation.

## Configuration

For now, role prompts and counts are in [`src/lib/agents.ts`](src/lib/agents.ts). Fork it, change them, send a PR if it's worth sharing.

Want different agents? Want them to call MCP servers? Want to pipe through specific working directories? Open an issue and let's design it.

## Contributing with an AI agent

Working on this repo with Claude Code, Cursor, or any other coding agent? Point it at [AGENTS.md](AGENTS.md). It has the file map, the variable contract, the workflow for adding a new theme or agent role, and the list of things to never do (e.g., "don't migrate to Vercel" — ultra-beers is local-first by construction).

## How this differs from cloud `/ultraplan`

ultra-beers and Anthropic's hosted `/ultraplan` are different products with overlapping intent. Honest comparison:

| | cloud `/ultraplan` | ultra-beers |
|---|---|---|
| **Where it runs** | claude.ai sandbox, repo uploaded | localhost, no upload |
| **Repo context** | Full repo cloned in | Per-plan `cwd` — agents grep your actual repo, no upload |
| **Shape of output** | One refined plan, ready to paste back | Three separate critiques, you merge |
| **Iteration** | Conversational back-and-forth | One-shot per click |
| **Token streaming** | Per-token | Chunked (Claude CLI limitation) |
| **Repo size limit** | Yes | None |
| **Prompts visible** | No | Yes — fork [`src/lib/agents.ts`](src/lib/agents.ts) |
| **Cost model** | Cloud-billed | Whatever your local `claude` calls cost |

Cloud `/ultraplan` is **one agent improving** the plan. ultra-beers is **three agents critiquing** it from independent angles. If you want a single rewritten plan, cloud is better. If you want adversarial review with full visibility into the orchestration, ultra-beers is the right tool.

## Themes (v0.5)

Three bundled themes, switchable from the picker in the top-right of the nav bar:

- **pixel** (default) — deep purple PICO-8 palette, Press Start 2P, neon accents, CRT scanlines
- **minimal** — light, system fonts, single blue accent (the "I have to use this at work" theme)
- **terminal** — green-on-black, VT323 everywhere, amber highlights

Choice persists to `localStorage` and is applied before paint (no flash). Write your own — every theme is a single CSS file with a `[data-theme="<id>"]` selector. See [THEMES.md](THEMES.md) for the variable contract.

## Decisions queue (v0.3)

A second surface for rapid-fire decisions: <http://localhost:4747/decisions>. Each card has a question, optional context, and 2–4 buttons. Click an option → it's recorded and the queue advances to the next pending decision. Add new ones via the API:

```bash
curl -s -X POST http://localhost:4747/api/decisions \
  -H "content-type: application/json" \
  -d '{
    "title": "Switch from Vercel to Cloudflare Pages?",
    "context": "Vercel build minutes are up 4x this quarter…",
    "options": [
      {"id":"yes","label":"Yes — migrate this sprint"},
      {"id":"no","label":"No — stick with Vercel"},
      {"id":"hybrid","label":"Hybrid — static on CF, functions on Vercel"}
    ]
  }'
```

Decisions are markdown files at `~/.ultra-beers/decisions/`. You can `cat` or grep them like anything else.

## Per-plan working directory

Each plan has an `agent cwd` field at the top of the workspace (or pass `--cwd` to the CLI). The three Claude subprocesses are spawned with that cwd, so the Verifier can `grep` and `ls` your actual repo when fact-checking the plan. The value is persisted in the plan's markdown frontmatter:

```markdown
---
cwd: /Users/you/Projects/your-repo
---

# Your plan title
...
```

`~/foo` is expanded, relative paths resolve against the server's cwd, and the API returns `400` if the directory doesn't exist.

## Roadmap

Ideas, not promises:

- Apply-this-suggestion button that inserts an agent's output into the plan
- Pluggable agent roster + custom roles
- Diff view between plan revisions
- Send to local Claude Code peers via the `claude-peers` MCP
- Iterative refinement (multi-turn instead of one-shot)
- Single-rewritten-plan output mode (closer to cloud `/ultraplan`)

## License

MIT. See [LICENSE](LICENSE).

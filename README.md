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
# from a heredoc
./bin/ub-refine.sh <<'PLAN'
# My plan
1. Add Clerk auth
2. Deploy to Vercel
PLAN

# from a file
./bin/ub-refine.sh < plan.md

# as an argument
./bin/ub-refine.sh "Quick plan: do X then Y"
```

## Claude Code slash command

A companion slash command lives at [`claude-commands/ultrabeers.md`](claude-commands/ultrabeers.md). Copy it to `~/.claude/commands/ultrabeers.md` and `/ultrabeers <plan>` will invoke ultra-beers from inside any Claude Code session, then summarize the three agents' critiques into a single patch list.

```bash
cp claude-commands/ultrabeers.md ~/.claude/commands/ultrabeers.md
```

## How it works

The Next.js API route `POST /api/refine` spawns `claude -p "<role prompt>" --output-format stream-json` once per role. Each process is a separate Claude Code session with full agent capabilities (tool use, file reading, MCP servers — whatever your default `claude` setup has). The route parses the streaming JSON output and forwards text deltas over Server-Sent Events to the browser.

Because each agent is a real Claude Code instance, the **Verifier** can actually grep your filesystem to check claimed paths exist. The Skeptic and Tightener can too, but the prompts steer them toward analysis instead of investigation.

## Configuration

For now, role prompts and counts are in [`src/lib/agents.ts`](src/lib/agents.ts). Fork it, change them, send a PR if it's worth sharing.

Want different agents? Want them to call MCP servers? Want to pipe through specific working directories? Open an issue and let's design it.

## How this differs from cloud `/ultraplan`

ultra-beers and Anthropic's hosted `/ultraplan` are different products with overlapping intent. Honest comparison:

| | cloud `/ultraplan` | ultra-beers |
|---|---|---|
| **Where it runs** | claude.ai sandbox, repo uploaded | localhost, no upload |
| **Repo context** | Full repo cloned in | Subprocesses inherit ultra-beers' cwd — your project isn't auto-loaded |
| **Shape of output** | One refined plan, ready to paste back | Three separate critiques, you merge |
| **Iteration** | Conversational back-and-forth | One-shot per click |
| **Token streaming** | Per-token | Chunked (Claude CLI limitation) |
| **Repo size limit** | Yes | None |
| **Prompts visible** | No | Yes — fork [`src/lib/agents.ts`](src/lib/agents.ts) |
| **Cost model** | Cloud-billed | Whatever your local `claude` calls cost |

Cloud `/ultraplan` is **one agent improving** the plan. ultra-beers is **three agents critiquing** it from independent angles. If you want a single rewritten plan, cloud is better. If you want adversarial review with full visibility into the orchestration, ultra-beers is the right tool.

## Roadmap

Ideas, not promises:

- Per-plan working directory (so Verifier greps the right repo, not ultra-beers itself)
- Apply-this-suggestion button that inserts an agent's output into the plan
- Pluggable agent roster + custom roles
- Diff view between plan revisions
- Send to local Claude Code peers via the `claude-peers` MCP
- Iterative refinement (multi-turn instead of one-shot)
- Single-rewritten-plan output mode (closer to cloud `/ultraplan`)

## License

MIT. See [LICENSE](LICENSE).

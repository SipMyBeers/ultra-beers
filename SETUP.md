# Setup

A 60-second install. ultra-beers is a Next.js app you run on `localhost`. Nothing leaves the machine unless you wire it to.

## Prerequisites

| Tool | Why |
|---|---|
| Node.js 20+ | Runtime |
| [Claude Code](https://claude.com/claude-code) installed and authenticated | Refiner agents spawn `claude -p` subprocesses |
| `gh` CLI (optional) | Pulls GitHub issues for the `/repos` tab |
| `git` (every system already has it) | Repo metadata for the deep-dive |

## Install

```bash
git clone https://github.com/SipMyBeers/ultra-beers
cd ultra-beers
npm install
npm run dev
```

Open <http://localhost:4747>. That's it. First boot creates `~/.ultra-beers/` and auto-detects:

- Obsidian-style vaults at `~/Documents/Kool/` and `~/Desktop/BRAND-KITS/` (the two are common defaults — you can add or override)
- Git repos under `~/Projects/active`, `~/Projects`, and `~/Documents/GitHub`

## Config

Everything lives in `~/.ultra-beers/config.json`. It is created on first boot with auto-detection; edit at any time:

```json
{
  "vaults": [
    { "id": "kool", "label": "Kool", "path": "~/Documents/Kool" }
  ],
  "repoRoots": [
    { "path": "~/code" },
    { "path": "~/work" }
  ]
}
```

Restart `npm run dev` after editing.

## Data on disk

| Path | What |
|---|---|
| `~/.ultra-beers/config.json` | Vaults + repo roots |
| `~/.ultra-beers/plans/*.md` | One markdown file per plan (frontmatter + body) |
| `~/.ultra-beers/decisions/*.md` | One markdown file per decision |
| `~/.ultra-beers/peers.json` | Last-known claude-peers roster |

All plain text. Back up with `tar`, version with `git`, edit with `vim` — ultra-beers re-reads on every request.

## Theme

Top-right of the nav has a dropdown: `pixel` (default, neon), `minimal` (work-appropriate), `terminal` (green-on-black). Choice persists to `localStorage`. To add your own theme, see [THEMES.md](THEMES.md).

## CLI

For headless plan refinement without the browser:

```bash
./bin/ub-refine.sh --cwd ~/Projects/your-repo <<'PLAN'
# Your plan
1. Step
2. Step
PLAN
```

Streams the three local Claude critics with colored output. Drop the slash commands into Claude Code:

```bash
cp claude-commands/*.md ~/.claude/commands/
```

Now `/ultrabeers <plan>` and `/ultrabridge` are available in any Claude Code session.

## Quick smoke test

After `npm run dev`:

```bash
# Should return 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4747

# Should return your auto-detected repos
curl -s http://localhost:4747/api/repos | jq '.repos[0]'

# Should dump everything as NDJSON
curl -s http://localhost:4747/api/export | head -3
```

## Next steps

- **Single-user**: open `/inbox` and start dropping `## Decision: …` headings into your project READMEs/ROADMAPs. They'll auto-surface.
- **Multi-session colony**: see [COLONY.md](COLONY.md) for claude-peers + orchestrator + builder/tester model recipe.
- **Pipelines and agents**: see [INTEGRATIONS.md](INTEGRATIONS.md) for REST/SSE/NDJSON contracts and skill-integration patterns.
- **MCP**: see [`mcp/`](mcp/) for the optional stdio MCP server that exposes ultra-beers as tools to any Claude Code session.

## Troubleshooting

- **Refinement says "claude CLI not found"** — install Claude Code and make sure `which claude` resolves.
- **`/repos` shows no issues** — `gh auth status` must show logged in; if not, `gh auth login`.
- **Empty `/inbox`** — detection is conservative. Add `## Decision: <thing>?` or `- [ ] decide …` to a README/ROADMAP. Reload.
- **Port 4747 already in use** — `ULTRA_BEERS_PORT=4848 npm run dev` (CLI scripts respect the same env var).
- **Want to wipe state** — `rm -rf ~/.ultra-beers/`. Repo files on disk untouched.

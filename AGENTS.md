# AGENTS.md

Instructions for AI coding agents extending ultra-beers. If a human pasted this repo into your context and asked you to add a theme, a new agent role, or a new slash command, you are the intended audience.

## What ultra-beers is

Local-first plan refinement and decision queue. A Next.js app at `localhost:4747` that spawns local `claude -p` subprocesses to critique plans, plus a decisions chooser and a peer dashboard backed by claude-peers MCP. **Not a Vercel/cloud app.** Anything that assumes ephemeral filesystems, serverless functions, or a hosted backend is wrong.

Read first:
- `README.md` — user-facing overview, current feature set
- `THEMES.md` — variable contract for theming (concise reference)
- `src/themes/pixel.css` — canonical theme; copy it as a starting point
- `src/lib/agents.ts` — Skeptic / Verifier / Tightener prompts

## Code map

```
src/
  app/
    page.tsx                 plans list + colony pane
    plan/[id]/page.tsx       plan editor + refinement panel
    decisions/page.tsx       decision queue
    decisions/[id]/page.tsx  one decision (chooser UI)
    api/
      plans/                 plan CRUD
      refine/                SSE endpoint, spawns 3 claude subprocesses
      decisions/             decision CRUD
      peers/                 peer registry GET + sync POST
    globals.css              base structural styles + var-driven components
    layout.tsx               next/font + theme-init.js + html data-theme
  components/
    PlanWorkspace.tsx        plan editor shell
    RefinementPanel.tsx      streaming agent output
    DecisionChooser.tsx      one-click decision UI
    PeersPane.tsx            colony dashboard
    TopNav.tsx               nav + ThemeSwitcher
    ThemeSwitcher.tsx        localStorage-persisted theme picker
  lib/
    plans.ts                 markdown + frontmatter parser, cwd validation
    agents.ts                spawnAgent() — boots claude with role prompts
    agent-types.ts           browser-safe types (no node:child_process)
    decisions.ts             decision storage + ## Options parser
    peers.ts                 peer registry on ~/.ultra-beers/peers.json
  themes/
    pixel.css                default — deep purple + neon + scanlines
    minimal.css              light, system fonts, single accent
    terminal.css             green-on-black CRT
bin/
  ub-refine.sh               CLI: pipe a plan, stream colored output
  _parse-sse.py              SSE → ANSI color parser
claude-commands/
  ultrabeers.md              /ultrabeers <plan> — refine from CC session
  ultrabridge.md             /ultrabridge — sync peers, route decisions
public/
  theme-init.js              pre-hydration FOUC prevention
```

## Adding a new theme

This is the most common extension. The whole point of the theme system is to make this a 5-file change with no JS or build step beyond Next's auto-reload.

### Workflow

1. **Read `src/themes/pixel.css` end to end** before writing yours. Every variable in there must be defined in your theme. Missing variables silently inherit the previous theme's value and cause weird mixed-look bugs.
2. Create `src/themes/<your-id>.css`. The whole file is one selector:
   ```css
   [data-theme="<your-id>"] {
     /* all the vars from the contract below */
   }
   ```
   Use a short, lowercase, kebab-case id. Max 12 characters or the dropdown wraps.
3. Define **every** variable from the contract (see `THEMES.md` for the full list). If your theme has no scanlines, set `--scanline-opacity: 0` — don't omit it.
4. Add an `@import "../themes/<your-id>.css";` line near the top of `src/app/globals.css` next to the other theme imports.
5. Append `{ id: "<your-id>", label: "<Label>" }` to the `THEMES` array in `src/components/ThemeSwitcher.tsx`.
6. Add `<your-id>` to the whitelist condition in `public/theme-init.js`. Without this step the theme appears to work in-session but won't restore after a reload — silent bug.
7. Run `npm run build`. Must exit 0.
8. Boot `npm run dev`, open `http://localhost:4747`, and switch through all themes (including the others) to confirm nothing broke. Test at least:
   - `/` (home with colony pane)
   - `/plan/<any-id>` (editor + refinement panel)
   - `/decisions/<any-id>` (chooser buttons)

### Variable contract (canonical)

The full list with semantic guidance lives in `THEMES.md`. Quick version: surfaces (`--bg`, `--bg-elev`, `--bg-elev-2`, `--border`, `--border-strong`), text (`--fg`, `--fg-dim`, `--fg-faint`), accents (`--accent`, `--accent-dim`, `--magenta`, `--cyan`, `--lime`, `--red`, `--orange`), agent roles (`--skeptic`, `--verifier`, `--tightener`), peer chips (`--peer-1`..`--peer-6`), fonts (`--font-heading`, `--font-body`, `--font-mono`), and style abstractions (`--heading-transform`, `--heading-letterspacing`, `--button-shadow*`, `--card-shadow`, `--card-border-width`, `--card-radius`, `--bg-gradient`, `--scanline-opacity`).

If a component looks wrong only in your theme, the fix is almost always either (a) a missing variable in your theme or (b) you need to scope an override under your selector — never modify `globals.css` to make your theme work.

### Component overrides

For drastic visual departures, scope the override under your selector:

```css
[data-theme="<your-id>"] .pixel-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
[data-theme="<your-id>"] .pixel-corner { display: none; }
```

See `src/themes/minimal.css` for the full pattern.

### Hard rules

- **Never** modify `src/app/globals.css` color or font logic. It's theme-agnostic.
- **Never** hardcode hex values inside component `.tsx` files. Use CSS variables.
- **Never** touch other theme files to make yours work. Each theme is self-contained.
- **Never** add `!important`. If you need it, your selector is wrong.
- **Never** ship without testing all three pages above. Theme bugs love to hide on inner routes.

## Adding a new vault source

The `/vault` tab reads any directory listed in `~/.ultra-beers/config.json` under `vaults`. To add a new vault type beyond plain Obsidian-style markdown trees:

1. The reader is `src/lib/vault.ts` — `scanVault(rootPath)` returns a typed `VaultEntry[]` tree, `readFileFromVault(vaultPath, relPath)` reads one file. Path traversal is rejected via `path.relative` checks.
2. To support a new extension (e.g., `.canvas`), update `ALLOWED_EXTS` in `src/lib/vault.ts`. Don't widen this to non-text formats.
3. To skip more directories, add to `SKIP_DIRS`.
4. The API at `src/app/api/vault/route.ts` is the only entry point — never expose vault paths through other routes.
5. Writes to the vault are intentionally absent. Don't add them without an explicit user-facing confirmation flow; corrupted Obsidian indexes are no fun.

## Adding a new agent role

The refinement engine currently runs three roles in parallel (Skeptic, Verifier, Tightener). To add a fourth:

1. Add the role id to the `AgentRole` union in `src/lib/agent-types.ts`.
2. Append it to `ROLES`.
3. Add a `ROLE_META` entry: `label`, `color` (a CSS var like `var(--orange)`), and a one-line `description`.
4. Add a prompt to `ROLE_PROMPTS` in `src/lib/agents.ts`. Follow the existing pattern: a clear role declaration, a short bullet list of what to look for, an explicit output format, and the `{{PLAN}}` placeholder at the end.
5. The UI (`RefinementPanel`) renders all roles automatically — no other changes needed.
6. Update `bin/_parse-sse.py` so the CLI also handles your role's color.

The output format matters as much as the role definition. The three existing roles output structured markdown lists; an agent that returns prose ruins the panel layout.

## Adding a new slash command companion

Slash commands live in `claude-commands/` in this repo and are copied to `~/.claude/commands/` by the user. Patterns:

- Frontmatter: `description` (shows in `/help`), `allowed-tools` (e.g., `Bash(*), mcp__claude-peers__*`).
- Body: instructions for Claude in second person. Reference `$ARGUMENTS` for user input.
- Constraints: always validate prerequisites (server running, file exists, etc.) before acting; bail cleanly on failure.

See `claude-commands/ultrabeers.md` (single-purpose) and `claude-commands/ultrabridge.md` (multi-subcommand) for the two patterns.

## Verifying any change

Before declaring done:

```bash
npm run build          # exits 0, no warnings about your changes
npm run dev            # boots clean, no console errors
```

Then manually exercise the feature you touched in the browser. Type-checking and build passing is necessary but not sufficient.

For changes to the refine endpoint specifically, also run an end-to-end test against the CLI:

```bash
./bin/ub-refine.sh --cwd . <<'PLAN'
# tiny test plan
1. Do a thing
2. Verify it
PLAN
```

You should see all roles spawn, stream, and complete with exit code 0.

## What to never do

- **Don't add features the user didn't ask for.** No "while we're at it" refactors, no preemptive abstractions, no test suites for features that don't have tests yet.
- **Don't migrate ultra-beers to Vercel** or any hosted platform. It is local-first by design (spawns local CLI subprocesses, reads/writes `~/.ultra-beers/`). Vercel-shaped suggestions are wrong by construction.
- **Don't add authentication.** It's a single-user local tool.
- **Don't introduce a state library** (Redux, Zustand, etc.). React state and the filesystem are enough.
- **Don't touch the markdown plan/decision format** without strong reason. Plain markdown files are the data plane on purpose — users can grep, edit, and version them outside the app.
- **Don't commit `~/.ultra-beers/` contents.** They belong on the user's machine.
- **Don't widen `node:child_process` imports to client code.** `src/lib/agents.ts` is server-only; client components import types from `src/lib/agent-types.ts` instead. The build will fail if you mix them.

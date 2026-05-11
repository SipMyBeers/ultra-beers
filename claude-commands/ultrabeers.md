---
description: Refine a plan locally via ultra-beers (3 parallel Claude critics — Skeptic, Verifier, Tightener)
allowed-tools: Bash(*)
---

# /ultrabeers

You're invoking the local open-source alternative to `/ultraplan`. It spawns three local Claude Code subprocesses in parallel against the plan and streams their critiques back. Visual distinction from `/ultraplan` (orange): ultra-beers uses **cyan/magenta/green**.

## Behavior

When the user invokes `/ultrabeers <plan>`:

1. The plan text is in `$ARGUMENTS` (may be empty if the user wants you to grab it from the latest `EnterPlanMode` / planning context — in that case extract it from the conversation).
2. Verify the ultra-beers dev server is reachable at `http://localhost:4747`. If not, suggest:
   ```
   cd ~/Projects/active/ultra-beers && npm run dev
   ```
   and ask the user to start it, then retry.
3. Pipe the plan into `~/Projects/active/ultra-beers/bin/ub-refine.sh` via stdin (NOT as an argument — plans contain shell metacharacters). Use a heredoc:
   ```bash
   ~/Projects/active/ultra-beers/bin/ub-refine.sh <<'ULTRABEERS_PLAN_EOF'
   <plan text here>
   ULTRABEERS_PLAN_EOF
   ```
4. The script prints color-coded streaming output from all three agents. Let it stream end-to-end (~30-90s).
5. After it finishes, summarize the **distinct, high-signal** points from each agent into a single bulleted patch list the user can apply to their plan. Group by:
   - **Hard blockers** (Skeptic + Verifier overlap — things that would actually break)
   - **Verify before shipping** (Verifier flags)
   - **Tighten** (Tightener's concrete edit suggestions)
   Skip generic restatements. Each bullet should be actionable.

## What this does NOT do

- It does not edit the plan file directly. The user merges suggestions themselves.
- It does not run iteratively — one shot per invocation. Re-run if you want more passes.
- It does not have your repo as context like cloud `/ultraplan` does. The Verifier agent's `cwd` is wherever ultra-beers was launched from (likely `~/Projects/active/ultra-beers`), so file-path verification is limited unless ultra-beers is enhanced to accept a `--cwd` flag.

## Gaps vs cloud /ultraplan (transparency for the user)

| Feature | Cloud `/ultraplan` | Local `/ultrabeers` |
|---|---|---|
| Repo cloned in | yes | no — runs against ultra-beers' cwd |
| Iterative refinement | yes | one-shot |
| Single refined plan output | yes | three critiques, manual merge |
| Token-by-token streaming | yes | chunked |
| Repo size limit | yes | none |
| Cost | cloud-billed | local `claude` calls |
| Source-visible prompts | no | yes — `src/lib/agents.ts` |

If the user asks for any of these missing features, point at the ultra-beers repo: <https://github.com/SipMyBeers/ultra-beers>.

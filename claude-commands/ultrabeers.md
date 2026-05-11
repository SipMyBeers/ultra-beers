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
3. Pick the working directory for the agents. The Verifier `claude` subprocess inherits this `cwd` and uses it to grep/check file paths, so it should be the repo the plan is about — typically `$PWD` of the user's current Claude Code session. Default to that unless the plan obviously refers to a different repo.
4. Pipe the plan into `~/Projects/active/ultra-beers/bin/ub-refine.sh` via stdin (NOT as an argument — plans contain shell metacharacters). Pass the cwd via `--cwd`:
   ```bash
   ~/Projects/active/ultra-beers/bin/ub-refine.sh --cwd "$PWD" <<'ULTRABEERS_PLAN_EOF'
   <plan text here>
   ULTRABEERS_PLAN_EOF
   ```
5. The script prints color-coded streaming output from all three agents. Let it stream end-to-end (~30-90s).
6. After it finishes, summarize the **distinct, high-signal** points from each agent into a single bulleted patch list the user can apply to their plan. Group by:
   - **Hard blockers** (Skeptic + Verifier overlap — things that would actually break)
   - **Verify before shipping** (Verifier flags)
   - **Tighten** (Tightener's concrete edit suggestions)
   Skip generic restatements. Each bullet should be actionable.

## What this does NOT do

- It does not edit the plan file directly. The user merges suggestions themselves.
- It does not run iteratively — one shot per invocation. Re-run if you want more passes.

## Gaps vs cloud /ultraplan (transparency for the user)

| Feature | Cloud `/ultraplan` | Local `/ultrabeers` |
|---|---|---|
| Repo cloned in | yes | Verifier inherits `--cwd` and can grep your actual repo |
| Iterative refinement | yes | one-shot |
| Single refined plan output | yes | three critiques, manual merge |
| Token-by-token streaming | yes | chunked |
| Repo size limit | yes | none |
| Cost | cloud-billed | local `claude` calls |
| Source-visible prompts | no | yes — `src/lib/agents.ts` |

If the user asks for any of these missing features, point at the ultra-beers repo: <https://github.com/SipMyBeers/ultra-beers>.

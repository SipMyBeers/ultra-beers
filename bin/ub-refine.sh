#!/usr/bin/env bash
# ub-refine.sh — pipe a plan to ultra-beers and print colored agent critiques
# Usage:
#   ub-refine.sh "plan text"
#   echo "plan text" | ub-refine.sh
#   ub-refine.sh < plan.md

set -uo pipefail

PORT="${ULTRA_BEERS_PORT:-4747}"
ROOT="${ULTRA_BEERS_ROOT:-$HOME/Projects/active/ultra-beers}"
URL="http://localhost:${PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/_parse-sse.py"

# Cyan/magenta theme — visually distinct from /ultraplan's orange.
C_TITLE='\033[1;36m'
C_DIM='\033[2m'
C_RED='\033[1;31m'
C_RESET='\033[0m'

# Collect plan from $1 or stdin.
if [[ $# -gt 0 ]]; then
  PLAN="$*"
else
  PLAN="$(cat)"
fi

if [[ -z "${PLAN// }" ]]; then
  echo "ub-refine: empty plan. pass it as an argument or pipe it in." >&2
  exit 2
fi

if ! curl -fsS -o /dev/null --max-time 2 "$URL/" 2>/dev/null; then
  printf '%bub-refine:%b ultra-beers is not running on port %s.\n' "$C_RED" "$C_RESET" "$PORT" >&2
  printf '  start it with: %bcd %s && npm run dev%b\n' "$C_DIM" "$ROOT" "$C_RESET" >&2
  exit 3
fi

printf '%b┌─ ultra-beers ─────────────────────────────────────────┐%b\n' "$C_TITLE" "$C_RESET"
printf '%b│%b  three local agents critique your plan in parallel.   %b│%b\n' "$C_TITLE" "$C_DIM" "$C_TITLE" "$C_RESET"
printf '%b└───────────────────────────────────────────────────────┘%b\n' "$C_TITLE" "$C_RESET"

PAYLOAD="$(PLAN="$PLAN" python3 -c 'import json,os; print(json.dumps({"plan": os.environ["PLAN"]}))')"

curl -fsSN --max-time 600 -X POST "$URL/api/refine" \
  -H "content-type: application/json" \
  --data-binary "$PAYLOAD" \
  | python3 "$PARSER"

STATUS=${PIPESTATUS[0]}
if [[ $STATUS -ne 0 ]]; then
  printf '\n%bub-refine: curl exited %s%b\n' "$C_DIM" "$STATUS" "$C_RESET" >&2
  exit "$STATUS"
fi

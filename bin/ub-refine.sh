#!/usr/bin/env bash
# ub-refine.sh — pipe a plan to ultra-beers and print colored agent critiques
# Usage:
#   ub-refine.sh [--cwd /path/to/repo] "plan text"
#   echo "plan text" | ub-refine.sh [--cwd /path/to/repo]
#   ub-refine.sh --cwd . < plan.md

set -uo pipefail

PORT="${ULTRA_BEERS_PORT:-4747}"
ROOT="${ULTRA_BEERS_ROOT:-$HOME/Projects/active/ultra-beers}"
URL="http://localhost:${PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/_parse-sse.py"

C_TITLE='\033[1;36m'
C_DIM='\033[2m'
C_RED='\033[1;31m'
C_FAINT='\033[0;36m'
C_RESET='\033[0m'

CWD=""
ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cwd)
      CWD="$2"
      shift 2
      ;;
    --cwd=*)
      CWD="${1#--cwd=}"
      shift
      ;;
    --help|-h)
      sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# //'
      exit 0
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#ARGS[@]} -gt 0 ]]; then
  PLAN="${ARGS[*]}"
else
  PLAN="$(cat)"
fi

if [[ -z "${PLAN// }" ]]; then
  echo "ub-refine: empty plan. pass it as an argument or pipe it in." >&2
  exit 2
fi

# Expand cwd: ~ → $HOME, . → $PWD, relative → absolute.
if [[ -n "$CWD" ]]; then
  if [[ "$CWD" == "~" ]]; then
    CWD="$HOME"
  elif [[ "$CWD" == "~/"* ]]; then
    CWD="$HOME/${CWD:2}"
  fi
  if [[ "$CWD" != /* ]]; then
    CWD="$(cd "$CWD" 2>/dev/null && pwd)" || {
      printf '%bub-refine:%b cwd does not exist: %s\n' "$C_RED" "$C_RESET" "$CWD" >&2
      exit 4
    }
  fi
  if [[ ! -d "$CWD" ]]; then
    printf '%bub-refine:%b cwd not a directory: %s\n' "$C_RED" "$C_RESET" "$CWD" >&2
    exit 4
  fi
fi

if ! curl -fsS -o /dev/null --max-time 2 "$URL/" 2>/dev/null; then
  printf '%bub-refine:%b ultra-beers is not running on port %s.\n' "$C_RED" "$C_RESET" "$PORT" >&2
  printf '  start it with: %bcd %s && npm run dev%b\n' "$C_DIM" "$ROOT" "$C_RESET" >&2
  exit 3
fi

printf '%b┌─ ultra-beers ─────────────────────────────────────────┐%b\n' "$C_TITLE" "$C_RESET"
printf '%b│%b  three local agents critique your plan in parallel.   %b│%b\n' "$C_TITLE" "$C_DIM" "$C_TITLE" "$C_RESET"
if [[ -n "$CWD" ]]; then
  printf '%b│%b  cwd: %s%b\n' "$C_TITLE" "$C_FAINT" "$CWD" "$C_RESET"
fi
printf '%b└───────────────────────────────────────────────────────┘%b\n' "$C_TITLE" "$C_RESET"

PAYLOAD="$(PLAN="$PLAN" CWD="$CWD" python3 -c '
import json, os
out = {"plan": os.environ["PLAN"]}
cwd = os.environ.get("CWD", "")
if cwd:
    out["cwd"] = cwd
print(json.dumps(out))
')"

curl -fsSN --max-time 600 -X POST "$URL/api/refine" \
  -H "content-type: application/json" \
  --data-binary "$PAYLOAD" \
  | python3 "$PARSER"

STATUS=${PIPESTATUS[0]}
if [[ $STATUS -ne 0 ]]; then
  printf '\n%bub-refine: curl exited %s%b\n' "$C_DIM" "$STATUS" "$C_RESET" >&2
  exit "$STATUS"
fi

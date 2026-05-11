#!/usr/bin/env python3
"""Parse ultra-beers /api/refine SSE stream from stdin and print colored output."""
import sys
import json

C = {
    "skeptic":   ("\033[1;35m", "\033[0;35m", "SKEPTIC"),
    "verifier":  ("\033[1;36m", "\033[0;36m", "VERIFIER"),
    "tightener": ("\033[1;32m", "\033[0;32m", "TIGHTENER"),
}
DIM = "\033[2m"
RED = "\033[1;31m"
RESET = "\033[0m"

started = set()


def banner(role: str) -> None:
    bold, _, label = C[role]
    print(f"\n{bold}── {label} ────────────────────────────────────────{RESET}", flush=True)


def write_delta(role: str, text: str) -> None:
    _, body, _ = C[role]
    sys.stdout.write(body + text + RESET)
    sys.stdout.flush()


for raw in sys.stdin:
    line = raw.strip()
    if not line.startswith("data: "):
        continue
    payload = line[6:].strip()
    if payload == "[DONE]":
        continue
    try:
        evt = json.loads(payload)
    except json.JSONDecodeError:
        continue
    t = evt.get("type")
    role = evt.get("role")
    if role not in C:
        continue
    if t == "start":
        if role not in started:
            started.add(role)
            banner(role)
    elif t == "delta":
        if role not in started:
            started.add(role)
            banner(role)
        write_delta(role, evt.get("text", ""))
    elif t == "done":
        code = evt.get("exitCode", -1)
        suffix = "" if code == 0 else f"  (exit {code})"
        print(f"\n{DIM}done.{suffix}{RESET}", flush=True)
    elif t == "error":
        msg = evt.get("message", "unknown error")
        print(f"\n{RED}{role.upper()} ERROR{RESET}: {msg}", flush=True)

print()

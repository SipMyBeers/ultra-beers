import "server-only";
import { spawn } from "node:child_process";
import type { AgentEvent, AgentRole } from "./agent-types";

const ROLE_PROMPTS: Record<AgentRole, string> = {
  skeptic: `You are the SKEPTIC reviewer. Your job is to find weaknesses in the plan below.

Look for:
- Hidden assumptions that haven't been verified
- Missing dependencies, prerequisites, or steps
- Risks the plan glosses over
- Vague language that could hide problems
- Steps that could fail silently

Output a short, brutal markdown bulleted list of concrete concerns. Each bullet should name the specific risk and quote the part of the plan it applies to. Skip generic advice. Be direct.

PLAN:
{{PLAN}}`,

  verifier: `You are the VERIFIER reviewer. Your job is to fact-check the plan below.

For every file path, function name, API endpoint, command, package, URL, or specific claim in the plan, decide if it is:
1. Plausibly correct (move on)
2. Suspicious — likely wrong, outdated, or made up

Use any tools available to check files exist, search the codebase, or verify references. If you cannot tool-verify, mark items as UNVERIFIED.

Output a short markdown list of items to double-check, grouped by status:
**Verified:** (item — note)
**Suspicious:** (item — why)
**Unverified:** (item — what to check)

Skip items that look correct and unambiguous. Be concise.

PLAN:
{{PLAN}}`,

  tightener: `You are the TIGHTENER reviewer. Your job is to make the plan sharper and more actionable.

Look for:
- Fluffy language that should be cut
- Steps that mix multiple actions and should be split
- Steps missing concrete acceptance criteria
- Duplication or things that could be combined
- Ordering improvements

Output a short markdown list of specific edits: quote the original, then show the tightened version. Each suggestion under one line where possible. No generic prose. No preamble.

PLAN:
{{PLAN}}`,
};

export function spawnAgent(
  role: AgentRole,
  plan: string,
  onEvent: (e: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    const prompt = ROLE_PROMPTS[role].replace("{{PLAN}}", plan);

    const child = spawn(
      "claude",
      ["-p", prompt, "--output-format", "stream-json", "--verbose"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      },
    );

    onEvent({ type: "start", role });

    let stderrBuf = "";
    let partialLine = "";

    const cleanup = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    };

    if (signal.aborted) {
      cleanup();
      onEvent({ type: "error", role, message: "aborted" });
      resolve();
      return;
    }
    signal.addEventListener("abort", cleanup, { once: true });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const full = partialLine + chunk;
      const lines = full.split("\n");
      partialLine = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const text = extractText(json);
          if (text) onEvent({ type: "delta", role, text });
        } catch {
          onEvent({ type: "delta", role, text: trimmed + "\n" });
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrBuf += chunk;
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      const msg =
        err.code === "ENOENT"
          ? "claude CLI not found in PATH. Install Claude Code first: https://claude.com/claude-code"
          : err.message;
      onEvent({ type: "error", role, message: msg });
      resolve();
    });

    child.on("close", (code) => {
      if (stderrBuf && code !== 0) {
        onEvent({ type: "error", role, message: stderrBuf.slice(0, 500) });
      }
      onEvent({ type: "done", role, exitCode: code ?? -1 });
      resolve();
    });
  });
}

function extractText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  if (obj.type === "assistant" && obj.message && typeof obj.message === "object") {
    const message = obj.message as { content?: unknown };
    if (Array.isArray(message.content)) {
      const parts: string[] = [];
      for (const block of message.content) {
        if (block && typeof block === "object") {
          const b = block as { type?: string; text?: string };
          if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
        }
      }
      if (parts.length) return parts.join("");
    }
  }

  return null;
}

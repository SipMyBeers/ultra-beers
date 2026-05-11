export type AgentRole = "skeptic" | "verifier" | "tightener";

export const ROLES: AgentRole[] = ["skeptic", "verifier", "tightener"];

export const ROLE_META: Record<AgentRole, { label: string; color: string; description: string }> = {
  skeptic: {
    label: "Skeptic",
    color: "var(--skeptic)",
    description: "Finds holes, missing dependencies, unverified assumptions.",
  },
  verifier: {
    label: "Verifier",
    color: "var(--verifier)",
    description: "Checks claimed file paths, APIs, and references actually exist.",
  },
  tightener: {
    label: "Tightener",
    color: "var(--tightener)",
    description: "Removes fluff, sharpens language, makes the plan actionable.",
  },
};

export type AgentEvent =
  | { type: "start"; role: AgentRole }
  | { type: "delta"; role: AgentRole; text: string }
  | { type: "done"; role: AgentRole; exitCode: number }
  | { type: "error"; role: AgentRole; message: string };

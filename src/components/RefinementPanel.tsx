"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ROLE_META, type AgentRole } from "@/lib/agent-types";

export type RoleStatus = "idle" | "running" | "done" | "error";
export type RoleState = { status: RoleStatus; output: string; error?: string };

export function RefinementPanel({
  roles,
  state,
  refining,
}: {
  roles: AgentRole[];
  state: Record<AgentRole, RoleState>;
  refining: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--fg-dim)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        Refinement {refining ? "· streaming" : ""}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {roles.map((role) => (
          <RoleSection key={role} role={role} state={state[role]} />
        ))}
      </div>
    </div>
  );
}

function RoleSection({ role, state }: { role: AgentRole; state: RoleState }) {
  const meta = ROLE_META[role];
  const statusLabel =
    state.status === "running"
      ? "running…"
      : state.status === "done"
        ? "done"
        : state.status === "error"
          ? "error"
          : "idle";

  return (
    <section
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "14px 18px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: meta.color,
              opacity: state.status === "idle" ? 0.4 : 1,
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{statusLabel}</span>
      </header>
      <p style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 8 }}>
        {meta.description}
      </p>
      <div
        className="markdown"
        style={{
          fontSize: 12,
          minHeight: state.status === "idle" ? 0 : 24,
        }}
      >
        {state.status === "error" ? (
          <pre
            style={{
              color: "var(--skeptic)",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              background: "var(--bg-elev-2)",
              padding: 8,
              borderRadius: 4,
            }}
          >
            {state.error}
          </pre>
        ) : state.output ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.output}</ReactMarkdown>
        ) : state.status === "running" ? (
          <span style={{ color: "var(--fg-faint)" }}>thinking…</span>
        ) : null}
      </div>
    </section>
  );
}

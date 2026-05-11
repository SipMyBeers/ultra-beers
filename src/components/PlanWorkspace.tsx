"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefinementPanel, type RoleState } from "./RefinementPanel";
import { ROLES, type AgentRole } from "@/lib/agent-types";

type Plan = {
  id: string;
  title: string;
  content: string;
  cwd?: string;
  updatedAt: number;
};
type ViewMode = "edit" | "preview" | "split";

export function PlanWorkspace({ initialPlan }: { initialPlan: Plan }) {
  const router = useRouter();
  const [content, setContent] = useState(initialPlan.content);
  const [cwd, setCwd] = useState(initialPlan.cwd ?? "");
  const [savedContent, setSavedContent] = useState(initialPlan.content);
  const [savedCwd, setSavedCwd] = useState(initialPlan.cwd ?? "");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("split");
  const [roles, setRoles] = useState<Record<AgentRole, RoleState>>(() => emptyRoles());
  const [refining, setRefining] = useState(false);
  const [resolvedCwd, setResolvedCwd] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = content !== savedContent || cwd !== savedCwd;
  const title = useMemo(() => deriveTitle(content), [content]);

  const save = useCallback(
    async (nextContent: string, nextCwd: string) => {
      setSaving(true);
      try {
        await fetch(`/api/plans/${initialPlan.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: nextContent, cwd: nextCwd }),
        });
        setSavedContent(nextContent);
        setSavedCwd(nextCwd);
      } finally {
        setSaving(false);
      }
    },
    [initialPlan.id],
  );

  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(content, cwd);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, cwd, dirty, save]);

  const refine = async () => {
    if (refining) {
      abortRef.current?.abort();
      return;
    }
    setRoles(emptyRoles());
    setResolvedCwd(null);
    setRefining(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: content, cwd: cwd || undefined }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "refinement failed");
        setRoles((prev) => ({
          ...prev,
          skeptic: { ...prev.skeptic, error: err, status: "error" },
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as
              | { type: "cwd"; cwd: string }
              | { type: "start"; role: AgentRole }
              | { type: "delta"; role: AgentRole; text: string }
              | { type: "done"; role: AgentRole; exitCode: number }
              | { type: "error"; role: AgentRole; message: string };
            if (parsed.type === "cwd") {
              setResolvedCwd(parsed.cwd);
              continue;
            }
            setRoles((prev) => applyEvent(prev, parsed));
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setRoles((prev) => ({
          ...prev,
          skeptic: {
            ...prev.skeptic,
            status: "error",
            error: (err as Error).message,
          },
        }));
      }
    } finally {
      setRefining(false);
      abortRef.current = null;
    }
  };

  const remove = async () => {
    if (!confirm("Delete this plan?")) return;
    await fetch(`/api/plans/${initialPlan.id}`, { method: "DELETE" });
    router.push("/");
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elev)",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link href="/" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
            ← plans
          </Link>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 480,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
            {saving ? "saving…" : dirty ? "•" : "saved"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {(["edit", "split", "preview"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                style={{
                  border: "none",
                  borderRadius: 0,
                  background: view === m ? "var(--bg-elev-2)" : "transparent",
                  color: view === m ? "var(--fg)" : "var(--fg-dim)",
                  fontSize: 12,
                  padding: "4px 10px",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <button onClick={remove} style={{ fontSize: 12, color: "var(--fg-dim)" }}>
            delete
          </button>
          <button
            className={refining ? undefined : "primary"}
            onClick={refine}
            style={{ minWidth: 130 }}
          >
            {refining ? "stop refinement" : "refine with agents"}
          </button>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          fontSize: 12,
        }}
      >
        <label htmlFor="cwd" style={{ color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
          agent cwd:
        </label>
        <input
          id="cwd"
          type="text"
          placeholder="/Users/you/Projects/your-repo  (so Verifier greps the right tree)"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "4px 8px",
          }}
        />
        {resolvedCwd && (
          <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>
            resolved → {resolvedCwd}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <section
          style={{
            flex: 1,
            display: "flex",
            minWidth: 0,
            borderRight: "1px solid var(--border)",
          }}
        >
          {(view === "edit" || view === "split") && (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 0,
                resize: "none",
                padding: "20px 24px",
                fontSize: 13,
                lineHeight: 1.6,
                background: "var(--bg)",
                outline: "none",
              }}
            />
          )}
          {view === "split" && <div style={{ width: 1, background: "var(--border)" }} />}
          {(view === "preview" || view === "split") && (
            <div
              className="markdown"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                fontSize: 13,
                background: "var(--bg-elev)",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </section>
        <aside
          style={{
            width: 420,
            minWidth: 360,
            flexShrink: 0,
            background: "var(--bg-elev)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <RefinementPanel roles={ROLES} state={roles} refining={refining} />
        </aside>
      </div>
    </main>
  );
}

function emptyRoles(): Record<AgentRole, RoleState> {
  return {
    skeptic: { status: "idle", output: "" },
    verifier: { status: "idle", output: "" },
    tightener: { status: "idle", output: "" },
  };
}

function applyEvent(
  prev: Record<AgentRole, RoleState>,
  evt:
    | { type: "start"; role: AgentRole }
    | { type: "delta"; role: AgentRole; text: string }
    | { type: "done"; role: AgentRole; exitCode: number }
    | { type: "error"; role: AgentRole; message: string },
): Record<AgentRole, RoleState> {
  const current = prev[evt.role];
  switch (evt.type) {
    case "start":
      return { ...prev, [evt.role]: { ...current, status: "running", output: "" } };
    case "delta":
      return {
        ...prev,
        [evt.role]: { ...current, status: "running", output: current.output + evt.text },
      };
    case "done":
      return {
        ...prev,
        [evt.role]: {
          ...current,
          status: evt.exitCode === 0 ? "done" : current.error ? "error" : "done",
        },
      };
    case "error":
      return {
        ...prev,
        [evt.role]: { ...current, status: "error", error: evt.message },
      };
  }
}

function deriveTitle(content: string): string {
  const line = content.split("\n").find((l) => l.startsWith("# "));
  return line ? line.slice(2).trim() : "Untitled";
}

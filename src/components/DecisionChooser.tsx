"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TopNav } from "./TopNav";

type Option = { id: string; label: string };
type Decision = {
  id: string;
  title: string;
  status: "pending" | "decided" | "skipped";
  context: string;
  options: Option[];
  chosenId?: string;
  note?: string;
  createdAt: number;
  decidedAt?: number;
};

export function DecisionChooser({
  decision,
  nextId,
  remaining,
}: {
  decision: Decision;
  nextId: string | null;
  remaining: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState(decision.note ?? "");

  const decide = async (chosenId: string) => {
    setBusy(chosenId);
    try {
      const res = await fetch(`/api/decisions/${decision.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "decide",
          chosenId,
          note: note || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`decision failed: ${text}`);
        return;
      }
      advance();
    } finally {
      setBusy(null);
    }
  };

  const skip = async () => {
    setBusy("skip");
    try {
      await fetch(`/api/decisions/${decision.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      advance();
    } finally {
      setBusy(null);
    }
  };

  const reopen = async () => {
    setBusy("reopen");
    try {
      await fetch(`/api/decisions/${decision.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const advance = () => {
    if (nextId) {
      router.push(`/decisions/${nextId}`);
    } else {
      router.push("/decisions");
    }
  };

  const decided = decision.status !== "pending";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
      <TopNav active="decisions" />

      <header style={{ marginTop: 24, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Link href="/decisions" style={{ color: "var(--fg-faint)", fontSize: 12 }}>
            ← all decisions
          </Link>
          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
            {remaining > 0
              ? `${remaining} pending`
              : decided
                ? `decided ${new Date(decision.decidedAt ?? 0).toLocaleString()}`
                : "no other pending"}
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
          {decision.title}
        </h1>
      </header>

      {decision.context && (
        <section
          className="markdown"
          style={{
            fontSize: 13,
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "14px 18px",
            marginBottom: 20,
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{decision.context}</ReactMarkdown>
        </section>
      )}

      {decided ? (
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 18,
            background: "var(--bg-elev)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 6 }}>
            {decision.status === "skipped" ? "SKIPPED" : "DECIDED"}
          </div>
          {decision.chosenId && (
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              <span style={{ color: "var(--accent)" }}>→ </span>
              {decision.options.find((o) => o.id === decision.chosenId)?.label ??
                decision.chosenId}
            </div>
          )}
          {decision.note && (
            <p style={{ color: "var(--fg-dim)", fontSize: 13, marginBottom: 12 }}>
              {decision.note}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={reopen} disabled={busy !== null}>
              reopen
            </button>
            {nextId && <Link href={`/decisions/${nextId}`} className="link-as-btn">
              <button className="primary">next →</button>
            </Link>}
          </div>
        </section>
      ) : (
        <>
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {decision.options.map((opt) => (
              <li key={opt.id}>
                <button
                  onClick={() => decide(opt.id)}
                  disabled={busy !== null}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 18px",
                    background: busy === opt.id ? "var(--accent)" : "var(--bg-elev)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: busy === opt.id ? "#1a1004" : "var(--fg)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11,
                      padding: "2px 6px",
                      background: "var(--bg-elev-2)",
                      color: "var(--fg-dim)",
                      borderRadius: 3,
                      letterSpacing: 0.4,
                    }}
                  >
                    {opt.id}
                  </span>
                  <span style={{ flex: 1 }}>{opt.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional: note explaining the call (saved with the decision)"
            rows={2}
            spellCheck={false}
            style={{
              width: "100%",
              fontSize: 12,
              padding: "8px 10px",
              marginBottom: 12,
              resize: "vertical",
              minHeight: 40,
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={skip} disabled={busy !== null} style={{ fontSize: 12 }}>
              skip for now
            </button>
            <Link
              href="/decisions"
              style={{ color: "var(--fg-faint)", fontSize: 12, alignSelf: "center" }}
            >
              back to queue
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

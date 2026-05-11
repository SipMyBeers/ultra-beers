"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "./TopNav";

type DecisionPoint = {
  source: string;
  type: "heading" | "task" | "marker";
  text: string;
  context: string;
  lineNumber: number;
};

type InboxItem = {
  id: string;
  repoId: string;
  repoName: string;
  repoSlug?: string;
  point: DecisionPoint;
  repoLastCommitAgeSeconds?: number;
};

type Inbox = {
  pendingManualDecisions: number;
  items: InboxItem[];
  scannedRepos: number;
  skippedInactive: number;
};

type Filter = "all" | "heading" | "task" | "marker";

function relTime(seconds?: number): string {
  if (seconds === undefined) return "—";
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 86400 / 30)}mo`;
}

const TYPE_COLOR: Record<DecisionPoint["type"], string> = {
  heading: "var(--magenta)",
  task: "var(--cyan)",
  marker: "var(--orange)",
};

export function InboxView({ inbox }: { inbox: Inbox }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [repoFilter, setRepoFilter] = useState<string>("");

  const repos = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of inbox.items) {
      if (!seen.has(item.repoId)) seen.set(item.repoId, item.repoName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [inbox.items]);

  const filtered = useMemo(() => {
    return inbox.items.filter((item) => {
      if (filter !== "all" && item.point.type !== filter) return false;
      if (repoFilter && item.repoId !== repoFilter) return false;
      return true;
    });
  }, [inbox.items, filter, repoFilter]);

  const counts = useMemo(() => {
    const c = { all: inbox.items.length, heading: 0, task: 0, marker: 0 };
    for (const item of inbox.items) c[item.point.type]++;
    return c;
  }, [inbox.items]);

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 80px" }}>
      <TopNav active="inbox" />

      <header style={{ marginTop: 24, marginBottom: 14 }}>
        <h1 style={{ color: "var(--magenta)", margin: 0 }}>inbox</h1>
        <p
          style={{
            color: "var(--fg-dim)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            marginTop: 2,
            letterSpacing: 0.4,
          }}
        >
          decisions detected across {inbox.scannedRepos} active repo
          {inbox.scannedRepos === 1 ? "" : "s"}
          {inbox.skippedInactive > 0 ? `, ${inbox.skippedInactive} idle skipped` : ""}.
        </p>
      </header>

      {inbox.pendingManualDecisions > 0 && (
        <Link
          href="/decisions"
          style={{
            display: "block",
            marginBottom: 14,
            padding: "8px 12px",
            border: "2px solid var(--accent)",
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent)",
            fontFamily: "var(--font-heading)",
            fontSize: 10,
            letterSpacing: 0.6,
            textShadow: "none",
          }}
        >
          {inbox.pendingManualDecisions} pending manual decision
          {inbox.pendingManualDecisions === 1 ? "" : "s"} → open queue
        </Link>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <FilterBtn
          label={`all · ${counts.all}`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterBtn
          label={`heading · ${counts.heading}`}
          active={filter === "heading"}
          onClick={() => setFilter("heading")}
          color={TYPE_COLOR.heading}
        />
        <FilterBtn
          label={`task · ${counts.task}`}
          active={filter === "task"}
          onClick={() => setFilter("task")}
          color={TYPE_COLOR.task}
        />
        <FilterBtn
          label={`marker · ${counts.marker}`}
          active={filter === "marker"}
          onClick={() => setFilter("marker")}
          color={TYPE_COLOR.marker}
        />
        <span style={{ flex: 1 }} />
        {repos.length > 1 && (
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            style={{ fontFamily: "var(--font-heading)", fontSize: 9 }}
          >
            <option value="">all repos · {repos.length}</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState items={inbox.items.length} />
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, padding: 0, margin: 0, listStyle: "none" }}>
          {filtered.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterBtn({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="ghost"
      style={{
        fontSize: 9,
        padding: "5px 10px",
        borderColor: active ? color ?? "var(--accent)" : undefined,
        color: active ? color ?? "var(--accent)" : undefined,
      }}
    >
      {label}
    </button>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "plan" | "decide">(null);
  const { point } = item;

  const ctx = `From ${item.repoSlug ?? item.repoName}: ${point.source}#L${point.lineNumber}

${point.context || point.text}`.trim();

  const decideThis = async () => {
    setBusy("decide");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${item.repoName}: ${point.text.slice(0, 80)}`,
          context: ctx,
          options: [
            { id: "yes", label: "Yes — proceed" },
            { id: "no", label: "No — drop or defer" },
            { id: "modify", label: "Modify — change scope first" },
            { id: "spike", label: "Spike — investigate before deciding" },
          ],
        }),
      });
      const data = (await res.json()) as { decision?: { id: string } };
      if (data.decision?.id) router.push(`/decisions/${data.decision.id}`);
    } finally {
      setBusy(null);
    }
  };

  const planThis = async () => {
    setBusy("plan");
    try {
      const content = `# ${point.text}

## Context

${ctx}

## Steps

1.
2.
3.

## Verification

`;
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { plan?: { id: string } };
      if (data.plan?.id) router.push(`/plan/${data.plan.id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      className="pixel-card flat"
      style={{
        padding: "10px 14px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 110, flexShrink: 0 }}>
        <Link
          href={`/repos/${encodeURIComponent(item.repoId)}`}
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--lime)",
            textShadow: "none",
          }}
        >
          {item.repoName}
        </Link>
        <span style={{ fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
          {point.source} · L{point.lineNumber} · {relTime(item.repoLastCommitAgeSeconds)}
        </span>
      </div>
      <span
        className="tag"
        style={{
          color: TYPE_COLOR[point.type],
          borderColor: TYPE_COLOR[point.type],
          flexShrink: 0,
        }}
      >
        {point.type}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--fg)", fontWeight: 500 }}>
          {point.text}
        </p>
        {point.context && point.context !== point.text && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              maxHeight: 36,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {point.context.slice(0, 200)}
            {point.context.length > 200 ? "…" : ""}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          onClick={planThis}
          disabled={busy !== null}
          className="ghost"
          style={{ fontSize: 9, padding: "3px 8px" }}
        >
          {busy === "plan" ? "…" : "plan"}
        </button>
        <button
          onClick={decideThis}
          disabled={busy !== null}
          className="ghost"
          style={{ fontSize: 9, padding: "3px 8px" }}
        >
          {busy === "decide" ? "…" : "decide"}
        </button>
      </div>
    </li>
  );
}

function EmptyState({ items }: { items: number }) {
  return (
    <div
      className="pixel-card flat"
      style={{
        padding: 36,
        textAlign: "center",
        color: "var(--fg-dim)",
      }}
    >
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, marginBottom: 8 }}>
        {items === 0 ? "no decision points detected" : "no items match this filter"}
      </p>
      <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>
        {items === 0
          ? "add a ## Decision: ... heading or a - [ ] decide ... task to a README/ROADMAP."
          : "loosen filters above."}
      </p>
    </div>
  );
}

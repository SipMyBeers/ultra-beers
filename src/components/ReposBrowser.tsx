"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "./TopNav";

type Repo = {
  id: string;
  name: string;
  path: string;
  slug?: string;
  currentBranch?: string;
  dirty?: boolean;
  lastCommit?: { sha: string; subject: string; ageSeconds: number };
};

type Issue = {
  number: number;
  title: string;
  body?: string;
  url: string;
  author?: string;
  labels?: string[];
  updatedAt?: string;
};

type IssuesState = {
  loading?: boolean;
  issues?: Issue[];
  error?: string;
};

function relTime(seconds: number): string {
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 86400 / 30)}mo ago`;
}

export function ReposBrowser({ initialRepos }: { initialRepos: Repo[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [issuesByRepo, setIssuesByRepo] = useState<Record<string, IssuesState>>({});

  const loadIssues = useCallback(
    async (id: string) => {
      setIssuesByRepo((prev) => ({ ...prev, [id]: { loading: true } }));
      try {
        const res = await fetch(`/api/repos/${encodeURIComponent(id)}/issues`);
        if (!res.ok) {
          setIssuesByRepo((prev) => ({
            ...prev,
            [id]: { error: `HTTP ${res.status}` },
          }));
          return;
        }
        const data = (await res.json()) as { issues?: Issue[] };
        setIssuesByRepo((prev) => ({
          ...prev,
          [id]: { issues: data.issues ?? [] },
        }));
      } catch (err) {
        setIssuesByRepo((prev) => ({
          ...prev,
          [id]: { error: (err as Error).message },
        }));
      }
    },
    [],
  );

  const toggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!issuesByRepo[id]) loadIssues(id);
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 80px" }}>
      <TopNav active="repos" />

      <header style={{ marginTop: 24, marginBottom: 18 }}>
        <h1 style={{ color: "var(--lime)", margin: 0 }}>repos</h1>
        <p
          style={{
            color: "var(--fg-dim)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            marginTop: 2,
            letterSpacing: 0.4,
          }}
        >
          local git repos with GitHub issues — open one, plan or decide it.
        </p>
      </header>

      {initialRepos.length === 0 ? (
        <EmptyState />
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {initialRepos.map((r) => (
            <li key={r.id}>
              <RepoCard
                repo={r}
                expanded={expandedId === r.id}
                onToggle={() => toggle(r.id)}
                issuesState={issuesByRepo[r.id]}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function RepoCard({
  repo,
  expanded,
  onToggle,
  issuesState,
}: {
  repo: Repo;
  expanded: boolean;
  onToggle: () => void;
  issuesState: IssuesState | undefined;
}) {
  return (
    <div className="pixel-card flat" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: 0,
        }}
      >
        <button
          onClick={onToggle}
          aria-label={expanded ? "collapse" : "expand"}
          title={expanded ? "hide issues" : "load issues"}
          style={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
            padding: "12px 8px 12px 14px",
            fontSize: 11,
            color: "var(--fg-faint)",
            letterSpacing: 0,
          }}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <Link
          href={`/repos/${encodeURIComponent(repo.id)}`}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--fg)",
            fontSize: 13,
            padding: "12px 16px 12px 0",
            textShadow: "none",
          }}
        >
          <span style={{ flex: 1, fontWeight: 600 }}>{repo.name}</span>
          {repo.slug && (
            <span
              className="tag"
              style={{
                fontFamily: "var(--font-mono)",
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              {repo.slug}
            </span>
          )}
          {repo.currentBranch && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--cyan)",
              }}
            >
              {repo.currentBranch}
            </span>
          )}
          {repo.dirty && (
            <span
              className="status-dot error"
              style={{ marginRight: 0 }}
              title="uncommitted changes"
            />
          )}
          {repo.lastCommit && (
            <span
              style={{
                fontSize: 10,
                color: "var(--fg-faint)",
                fontFamily: "var(--font-mono)",
              }}
              title={`${repo.lastCommit.sha} · ${repo.lastCommit.subject}`}
            >
              {relTime(repo.lastCommit.ageSeconds)}
            </span>
          )}
        </Link>
      </div>
      {expanded && <IssuesList repo={repo} state={issuesState} />}
    </div>
  );
}

function IssuesList({ repo, state }: { repo: Repo; state: IssuesState | undefined }) {
  if (!state || state.loading) {
    return (
      <div
        style={{
          padding: "8px 16px 14px 36px",
          fontSize: 11,
          color: "var(--fg-faint)",
          fontFamily: "var(--font-mono)",
        }}
      >
        loading issues…
      </div>
    );
  }
  if (state.error) {
    return (
      <div
        style={{
          padding: "8px 16px 14px 36px",
          fontSize: 11,
          color: "var(--red)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {state.error}
      </div>
    );
  }
  if (!repo.slug) {
    return (
      <div
        style={{
          padding: "8px 16px 14px 36px",
          fontSize: 11,
          color: "var(--fg-faint)",
          fontFamily: "var(--font-mono)",
        }}
      >
        no GitHub remote — issues unavailable. path: {repo.path}
      </div>
    );
  }
  const issues = state.issues ?? [];
  if (issues.length === 0) {
    return (
      <div
        style={{
          padding: "8px 16px 14px 36px",
          fontSize: 11,
          color: "var(--fg-faint)",
          fontFamily: "var(--font-mono)",
        }}
      >
        no open issues.{" "}
        <a href={`https://github.com/${repo.slug}/issues/new`} target="_blank" rel="noreferrer">
          open one →
        </a>
      </div>
    );
  }
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: "4px 12px 12px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderTop: "1px solid var(--border)",
      }}
    >
      {issues.map((issue) => (
        <li key={issue.number}>
          <IssueRow repo={repo} issue={issue} />
        </li>
      ))}
    </ul>
  );
}

function IssueRow({ repo, issue }: { repo: Repo; issue: Issue }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "plan" | "decide">(null);

  const buildContext = () => {
    const body = (issue.body ?? "").trim();
    const labels = issue.labels && issue.labels.length > 0
      ? `Labels: ${issue.labels.join(", ")}\n`
      : "";
    return `From ${repo.slug}#${issue.number} (${issue.url})

${labels}${body || "_no description_"}`.trim();
  };

  const planThis = async () => {
    setBusy("plan");
    try {
      const content = `# ${repo.name}#${issue.number}: ${issue.title}

## Context

${buildContext()}

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

  const decideThis = async () => {
    setBusy("decide");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${repo.name}#${issue.number}: ${issue.title}`,
          context: buildContext(),
          options: [
            { id: "ship", label: "Ship — work on it now" },
            { id: "later", label: "Later — keep in backlog" },
            { id: "close", label: "Close — won't do" },
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        borderBottom: "1px dashed var(--border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-faint)",
          minWidth: 36,
        }}
      >
        #{issue.number}
      </span>
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        style={{
          flex: 1,
          color: "var(--fg)",
          fontSize: 12,
          textShadow: "none",
        }}
        title={issue.title}
      >
        {issue.title}
      </a>
      {issue.labels && issue.labels.length > 0 && (
        <span style={{ display: "flex", gap: 4 }}>
          {issue.labels.slice(0, 2).map((l) => (
            <span key={l} className="tag" style={{ fontSize: 8 }}>
              {l}
            </span>
          ))}
        </span>
      )}
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
  );
}

function EmptyState() {
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
        no repos found
      </p>
      <p style={{ fontSize: 12, color: "var(--fg-faint)", marginBottom: 12 }}>
        ultra-beers looks for git repos under <code style={{ color: "var(--lime)" }}>~/Projects/active</code>,{" "}
        <code style={{ color: "var(--lime)" }}>~/Projects</code>, and{" "}
        <code style={{ color: "var(--lime)" }}>~/Documents/GitHub</code>.
      </p>
      <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>
        Add a different root in{" "}
        <code style={{ color: "var(--lime)" }}>~/.ultra-beers/config.json</code>:
      </p>
      <pre
        style={{
          background: "var(--bg)",
          padding: 12,
          border: "1px solid var(--border)",
          textAlign: "left",
          fontSize: 11,
          maxWidth: 420,
          margin: "10px auto 0",
        }}
      >
{`{
  "repoRoots": [{ "path": "~/code" }]
}`}
      </pre>
    </div>
  );
}

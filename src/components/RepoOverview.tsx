"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

type DecisionPoint = {
  source: string;
  type: "heading" | "task" | "marker";
  text: string;
  context: string;
  lineNumber: number;
};

type Overview = {
  repo: Repo;
  recentCommits: Array<{ sha: string; subject: string; author: string; ageSeconds: number }>;
  dirtyFiles: string[];
  readme: { name: string; content: string } | null;
  roadmap: { name: string; content: string } | null;
  decisionPoints: DecisionPoint[];
  linkedVaultNotes: Array<{ vaultId: string; vaultLabel: string; path: string }>;
};

type Issue = {
  number: number;
  title: string;
  body?: string;
  url: string;
  labels?: string[];
};

function relTime(seconds: number): string {
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 86400 / 30)}mo ago`;
}

export function RepoOverview({ overview }: { overview: Overview }) {
  const { repo, recentCommits, dirtyFiles, readme, roadmap, decisionPoints, linkedVaultNotes } =
    overview;
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repos/${encodeURIComponent(repo.id)}/issues`);
        const data = (await res.json()) as { issues?: Issue[] };
        if (!cancelled) setIssues(data.issues ?? []);
      } catch {
        if (!cancelled) setIssues([]);
      } finally {
        if (!cancelled) setIssuesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo.id]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 80px" }}>
      <TopNav active="repos" />

      <header style={{ marginTop: 24, marginBottom: 14 }}>
        <Link
          href="/repos"
          style={{ color: "var(--fg-faint)", fontSize: 12, textShadow: "none" }}
        >
          ← repos
        </Link>
        <h1 style={{ color: "var(--lime)", margin: "4px 0 4px" }}>{repo.name}</h1>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--fg-dim)",
            flexWrap: "wrap",
          }}
        >
          {repo.slug && (
            <a href={`https://github.com/${repo.slug}`} target="_blank" rel="noreferrer">
              {repo.slug}
            </a>
          )}
          {repo.currentBranch && (
            <span style={{ color: "var(--cyan)" }}>{repo.currentBranch}</span>
          )}
          {repo.dirty && (
            <span style={{ color: "var(--red)" }}>
              <span className="status-dot error" />
              dirty
            </span>
          )}
          {repo.lastCommit && (
            <span>
              last commit {relTime(repo.lastCommit.ageSeconds)} — {repo.lastCommit.subject}
            </span>
          )}
          <span style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{repo.path}</span>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
          marginTop: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section title="decisions to make" color="magenta">
            {decisionPoints.length === 0 ? (
              <Hint>
                No decision points detected in {roadmap?.name ?? "the roadmap"}/{readme?.name ?? "README"}.
                Add a <code>## Decision: ...</code> heading or a{" "}
                <code>- [ ] decide ...</code> task to surface one.
              </Hint>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {decisionPoints.map((d, i) => (
                  <DecisionRow key={`${d.lineNumber}-${i}`} repo={repo} point={d} />
                ))}
              </ul>
            )}
          </Section>

          {roadmap && (
            <Section title={`roadmap · ${roadmap.name}`} color="accent">
              <div className="markdown" style={{ maxHeight: 360, overflowY: "auto" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {roadmap.content}
                </ReactMarkdown>
              </div>
            </Section>
          )}

          {readme && !roadmap && (
            <Section title={`readme · ${readme.name}`} color="accent">
              <div className="markdown" style={{ maxHeight: 360, overflowY: "auto" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {readme.content}
                </ReactMarkdown>
              </div>
            </Section>
          )}

          {readme && roadmap && (
            <Section title={`readme · ${readme.name}`} color="cyan">
              <div className="markdown" style={{ maxHeight: 280, overflowY: "auto" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {readme.content}
                </ReactMarkdown>
              </div>
            </Section>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section title="recent commits" color="cyan">
            {recentCommits.length === 0 ? (
              <Hint>No commits.</Hint>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {recentCommits.map((c) => (
                  <li
                    key={c.sha}
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span style={{ color: "var(--fg-faint)", minWidth: 56 }}>{c.sha}</span>
                    <span style={{ flex: 1, color: "var(--fg)" }} title={c.subject}>
                      {c.subject}
                    </span>
                    <span style={{ color: "var(--fg-faint)", whiteSpace: "nowrap" }}>
                      {relTime(c.ageSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {dirtyFiles.length > 0 && (
            <Section title={`uncommitted · ${dirtyFiles.length}`} color="red">
              <ul style={{ listStyle: "none", margin: 0, padding: 0, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {dirtyFiles.map((f) => (
                  <li key={f} style={{ color: "var(--fg-dim)" }}>
                    {f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`open issues${issues ? ` · ${issues.length}` : ""}`} color="orange">
            {issuesLoading ? (
              <Hint>loading…</Hint>
            ) : !repo.slug ? (
              <Hint>no GitHub remote</Hint>
            ) : !issues || issues.length === 0 ? (
              <Hint>no open issues</Hint>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {issues.slice(0, 12).map((issue) => (
                  <IssueRow key={issue.number} repo={repo} issue={issue} />
                ))}
              </ul>
            )}
          </Section>

          {linkedVaultNotes.length > 0 && (
            <Section title={`vault notes · ${linkedVaultNotes.length}`} color="magenta">
              <ul style={{ listStyle: "none", margin: 0, padding: 0, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {linkedVaultNotes.slice(0, 12).map((n) => (
                  <li key={`${n.vaultId}/${n.path}`} style={{ marginBottom: 4 }}>
                    <Link
                      href={`/vault?vault=${encodeURIComponent(n.vaultId)}&path=${encodeURIComponent(n.path)}`}
                      style={{ color: "var(--fg)", textShadow: "none" }}
                    >
                      <span style={{ color: "var(--fg-faint)" }}>{n.vaultLabel}/</span>
                      {n.path}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: "magenta" | "cyan" | "lime" | "accent" | "red" | "orange";
  children: React.ReactNode;
}) {
  return (
    <section className="pixel-card flat" style={{ padding: 14 }}>
      <h2 style={{ color: `var(--${color})`, margin: "0 0 10px" }}>{title}</h2>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "var(--fg-faint)",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

function DecisionRow({ repo, point }: { repo: Repo; point: DecisionPoint }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "plan" | "decide">(null);

  const ctx = `From ${repo.slug ?? repo.name}: ${point.source}#L${point.lineNumber}

${point.context || point.text}`.trim();

  const decideThis = async () => {
    setBusy("decide");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${repo.name}: ${point.text.slice(0, 80)}`,
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

  const typeBadge = {
    heading: { label: point.source, color: "var(--magenta)" },
    task: { label: "task", color: "var(--cyan)" },
    marker: { label: point.source === "README" ? "marker" : point.source, color: "var(--orange)" },
  }[point.type];

  return (
    <li
      style={{
        border: "1px solid var(--border)",
        padding: "8px 10px",
        background: "var(--bg)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        className="tag"
        style={{ color: typeBadge.color, borderColor: typeBadge.color, flexShrink: 0 }}
      >
        {typeBadge.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--fg)" }}>{point.text}</p>
        {point.context && point.context !== point.text && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              maxHeight: 40,
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

function IssueRow({ repo, issue }: { repo: Repo; issue: Issue }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "plan" | "decide">(null);

  const ctx = `From ${repo.slug}#${issue.number} (${issue.url})

${issue.body?.trim() || "_no description_"}`;

  const decideThis = async () => {
    setBusy("decide");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${repo.name}#${issue.number}: ${issue.title}`,
          context: ctx,
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

  const planThis = async () => {
    setBusy("plan");
    try {
      const content = `# ${repo.name}#${issue.number}: ${issue.title}

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
    <li style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
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
        style={{ flex: 1, color: "var(--fg)", textShadow: "none", fontSize: 11 }}
      >
        {issue.title}
      </a>
      <button
        onClick={planThis}
        disabled={busy !== null}
        className="ghost"
        style={{ fontSize: 9, padding: "2px 6px" }}
      >
        {busy === "plan" ? "…" : "plan"}
      </button>
      <button
        onClick={decideThis}
        disabled={busy !== null}
        className="ghost"
        style={{ fontSize: 9, padding: "2px 6px" }}
      >
        {busy === "decide" ? "…" : "decide"}
      </button>
    </li>
  );
}

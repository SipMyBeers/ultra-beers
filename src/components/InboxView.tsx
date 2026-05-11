"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TopNav } from "./TopNav";
import { ItemActions } from "./ItemActions";

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

export function InboxView({ inbox: initial }: { inbox: Inbox }) {
  const [inbox, setInbox] = useState<Inbox>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "stale" | "off">("connecting");
  const [lastSyncMs, setLastSyncMs] = useState<number>(Date.now());
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const newTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const es = new EventSource("/api/inbox/stream");
    es.addEventListener("snapshot", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as Inbox;
        setInbox(data);
        setLastSyncMs(Date.now());
        setLiveStatus("live");
      } catch {
        // ignore malformed
      }
    });
    es.addEventListener("delta", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          added: string[];
          removed: string[];
        };
        if (data.added.length > 0) {
          setNewItemIds((prev) => {
            const next = new Set(prev);
            for (const id of data.added) {
              next.add(id);
              const existing = newTimers.current.get(id);
              if (existing) clearTimeout(existing);
              newTimers.current.set(
                id,
                setTimeout(() => {
                  setNewItemIds((p) => {
                    const np = new Set(p);
                    np.delete(id);
                    return np;
                  });
                  newTimers.current.delete(id);
                }, 6000),
              );
            }
            return next;
          });
        }
      } catch {
        // ignore
      }
    });
    es.addEventListener("heartbeat", () => {
      setLastSyncMs(Date.now());
      setLiveStatus("live");
    });
    es.onerror = () => {
      setLiveStatus("stale");
    };
    return () => {
      es.close();
      for (const t of newTimers.current.values()) clearTimeout(t);
      newTimers.current.clear();
      setLiveStatus("off");
    };
  }, []);

  // Re-render once a minute so relative timestamps freshen.
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

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

  const syncAge = Math.floor((Date.now() - lastSyncMs) / 1000);

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 80px" }}>
      <TopNav active="inbox" />

      <header
        style={{
          marginTop: 24,
          marginBottom: 14,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
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
        </div>
        <LiveBadge status={liveStatus} ageSeconds={syncAge} />
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
        <ul
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 0,
            margin: 0,
            listStyle: "none",
          }}
        >
          {filtered.map((item) => (
            <InboxRow key={item.id} item={item} isNew={newItemIds.has(item.id)} />
          ))}
        </ul>
      )}
    </main>
  );
}

function LiveBadge({
  status,
  ageSeconds,
}: {
  status: "connecting" | "live" | "stale" | "off";
  ageSeconds: number;
}) {
  const { dotClass, label } = (() => {
    if (status === "live")
      return { dotClass: "status-dot", label: `live · ${relTime(ageSeconds)}` };
    if (status === "stale")
      return { dotClass: "status-dot error", label: "reconnecting…" };
    if (status === "connecting")
      return { dotClass: "status-dot stale", label: "connecting…" };
    return { dotClass: "status-dot stale", label: "offline" };
  })();
  return (
    <span
      className="tag"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-heading)",
        fontSize: 9,
      }}
    >
      <span className={dotClass} style={{ marginRight: 0 }} />
      {label}
    </span>
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

function InboxRow({ item, isNew }: { item: InboxItem; isNew: boolean }) {
  const { point } = item;
  const ctx = `From ${item.repoSlug ?? item.repoName}: ${point.source}#L${point.lineNumber}

${point.context || point.text}`.trim();

  return (
    <li
      className="pixel-card flat"
      style={{
        padding: "10px 14px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        outline: isNew ? "2px solid var(--accent)" : "none",
        outlineOffset: isNew ? -1 : 0,
        transition: "outline-color 600ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 110,
          flexShrink: 0,
        }}
      >
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
        <span
          style={{ fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}
        >
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
      <ItemActions
        title={`${item.repoName}: ${point.text.slice(0, 80)}`}
        context={ctx}
        planTitle={point.text}
      />
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

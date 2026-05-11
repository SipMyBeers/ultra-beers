"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TopNav } from "./TopNav";
import type { VaultEntry } from "@/lib/vault";

type VaultRef = { id: string; label: string };

export function VaultBrowser({
  vaults,
  activeVaultId,
  activeVaultPath,
  entries,
  initialFilePath,
}: {
  vaults: VaultRef[];
  activeVaultId: string | null;
  activeVaultPath: string | null;
  entries: VaultEntry[];
  initialFilePath: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [filePath, setFilePath] = useState<string | null>(initialFilePath);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | "plan" | "decide">(null);
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set([""]));

  const loadFile = useCallback(
    async (path: string) => {
      if (!activeVaultId) return;
      setLoading(true);
      setContent(null);
      try {
        const res = await fetch(
          `/api/vault?vault=${encodeURIComponent(activeVaultId)}&path=${encodeURIComponent(path)}`,
        );
        if (!res.ok) {
          setContent(`*could not load ${path}*`);
          return;
        }
        const data = (await res.json()) as { file?: { content?: string } };
        setContent(data.file?.content ?? "");
      } finally {
        setLoading(false);
      }
    },
    [activeVaultId],
  );

  useEffect(() => {
    if (filePath) loadFile(filePath);
  }, [filePath, loadFile]);

  const flatFiles = useMemo(() => flattenFiles(entries), [entries]);
  const filteredFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return null;
    return flatFiles.filter((f) => f.path.toLowerCase().includes(q));
  }, [filter, flatFiles]);

  const planThis = async () => {
    if (!content || busy) return;
    setBusy("plan");
    try {
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
    if (!content || busy) return;
    setBusy("decide");
    try {
      const title = (filePath?.split("/").pop() || "Decision").replace(/\.md$/i, "");
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Decide: ${title}`,
          context: content.slice(0, 2000),
          options: [
            { id: "yes", label: "Yes — proceed as described" },
            { id: "no", label: "No — defer or drop" },
            { id: "modify", label: "Modify — needs changes before deciding" },
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
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px 80px" }}>
      <TopNav active="vault" />

      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 24,
          marginBottom: 16,
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ color: "var(--cyan)", margin: 0 }}>vault</h1>
          <p
            style={{
              color: "var(--fg-dim)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              marginTop: 2,
              letterSpacing: 0.4,
            }}
          >
            {activeVaultPath ?? "no vault configured"}
          </p>
        </div>
        {vaults.length > 1 && (
          <select
            value={activeVaultId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              router.push(`/vault?vault=${encodeURIComponent(id)}`);
            }}
            style={{ fontFamily: "var(--font-heading)", fontSize: 9 }}
          >
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
      </header>

      {vaults.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 320px) 1fr",
            gap: 16,
            minHeight: 600,
          }}
        >
          <aside
            className="pixel-card flat"
            style={{ padding: 12, overflow: "hidden" }}
          >
            <input
              type="text"
              placeholder="filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: "100%", fontSize: 12, marginBottom: 10 }}
            />
            <div
              style={{
                maxHeight: "calc(100vh - 240px)",
                overflowY: "auto",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              {filteredFiles ? (
                <FlatFileList
                  files={filteredFiles}
                  activePath={filePath}
                  onSelect={setFilePath}
                />
              ) : (
                <FileTree
                  entries={entries}
                  parent=""
                  open={openDirs}
                  setOpen={setOpenDirs}
                  activePath={filePath}
                  onSelect={setFilePath}
                />
              )}
            </div>
          </aside>

          <section
            className="pixel-card"
            style={{ padding: 18, display: "flex", flexDirection: "column", minHeight: 600 }}
          >
            {filePath ? (
              <>
                <header
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    paddingBottom: 12,
                    borderBottom: "1px solid var(--border)",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-dim)",
                      wordBreak: "break-all",
                    }}
                  >
                    {filePath}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={planThis}
                      disabled={!content || busy !== null}
                      className="primary"
                    >
                      {busy === "plan" ? "creating…" : "plan this"}
                    </button>
                    <button onClick={decideThis} disabled={!content || busy !== null}>
                      {busy === "decide" ? "creating…" : "decide this"}
                    </button>
                  </div>
                </header>
                <div className="markdown" style={{ flex: 1, overflowY: "auto" }}>
                  {loading ? (
                    <span style={{ color: "var(--fg-faint)" }}>loading…</span>
                  ) : content !== null ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  ) : null}
                </div>
              </>
            ) : (
              <div
                style={{
                  margin: "auto",
                  color: "var(--fg-faint)",
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                }}
              >
                pick a file on the left to read it.
                <br />
                use <code style={{ color: "var(--lime)" }}>plan this</code> or{" "}
                <code style={{ color: "var(--lime)" }}>decide this</code> to route it
                into the rest of ultra-beers.
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function FileTree({
  entries,
  parent,
  open,
  setOpen,
  activePath,
  onSelect,
}: {
  entries: VaultEntry[];
  parent: string;
  open: Set<string>;
  setOpen: (s: Set<string>) => void;
  activePath: string | null;
  onSelect: (p: string) => void;
}) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {entries.map((e) => {
        const isOpen = open.has(e.path || parent);
        if (e.type === "dir") {
          return (
            <li key={e.path} style={{ marginLeft: parent ? 12 : 0 }}>
              <button
                className="ghost"
                onClick={() => {
                  const next = new Set(open);
                  if (next.has(e.path)) next.delete(e.path);
                  else next.add(e.path);
                  setOpen(next);
                }}
                style={{
                  textAlign: "left",
                  width: "100%",
                  padding: "3px 6px",
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  color: "var(--fg-dim)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: 0,
                  textTransform: "none",
                }}
              >
                {isOpen ? "▾" : "▸"} {e.name}
              </button>
              {isOpen && e.children && (
                <FileTree
                  entries={e.children}
                  parent={e.path}
                  open={open}
                  setOpen={setOpen}
                  activePath={activePath}
                  onSelect={onSelect}
                />
              )}
            </li>
          );
        }
        const active = activePath === e.path;
        return (
          <li key={e.path} style={{ marginLeft: parent ? 12 : 0 }}>
            <button
              className="ghost"
              onClick={() => onSelect(e.path)}
              style={{
                textAlign: "left",
                width: "100%",
                padding: "3px 6px",
                background: active ? "var(--bg-elev-2)" : "transparent",
                border: "none",
                boxShadow: "none",
                color: active ? "var(--accent)" : "var(--fg)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: 0,
                textTransform: "none",
              }}
            >
              {e.name.replace(/\.(md|markdown|mdx)$/i, "")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FlatFileList({
  files,
  activePath,
  onSelect,
}: {
  files: Array<{ path: string; name: string }>;
  activePath: string | null;
  onSelect: (p: string) => void;
}) {
  if (files.length === 0) {
    return <p style={{ color: "var(--fg-faint)", fontSize: 12 }}>no matches</p>;
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {files.slice(0, 200).map((f) => {
        const active = activePath === f.path;
        return (
          <li key={f.path}>
            <button
              className="ghost"
              onClick={() => onSelect(f.path)}
              style={{
                textAlign: "left",
                width: "100%",
                padding: "3px 6px",
                background: active ? "var(--bg-elev-2)" : "transparent",
                border: "none",
                boxShadow: "none",
                color: active ? "var(--accent)" : "var(--fg)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: 0,
                textTransform: "none",
              }}
              title={f.path}
            >
              {f.path.replace(/\.(md|markdown|mdx)$/i, "")}
            </button>
          </li>
        );
      })}
      {files.length > 200 && (
        <li style={{ color: "var(--fg-faint)", fontSize: 10, marginTop: 6 }}>
          showing 200 of {files.length} — refine filter
        </li>
      )}
    </ul>
  );
}

function flattenFiles(entries: VaultEntry[]): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = [];
  const walk = (es: VaultEntry[]) => {
    for (const e of es) {
      if (e.type === "file") out.push({ path: e.path, name: e.name });
      if (e.type === "dir" && e.children) walk(e.children);
    }
  };
  walk(entries);
  return out;
}

function EmptyState() {
  return (
    <div
      className="pixel-card flat"
      style={{
        padding: 40,
        textAlign: "center",
        color: "var(--fg-dim)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          marginBottom: 10,
        }}
      >
        no vaults configured
      </p>
      <p style={{ fontSize: 12, color: "var(--fg-faint)", marginBottom: 12 }}>
        edit <code style={{ color: "var(--lime)" }}>~/.ultra-beers/config.json</code>:
      </p>
      <pre
        style={{
          background: "var(--bg)",
          padding: 14,
          border: "1px solid var(--border)",
          textAlign: "left",
          fontSize: 11,
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
{`{
  "vaults": [
    { "id": "kool", "label": "Kool", "path": "~/Documents/Kool" }
  ]
}`}
      </pre>
    </div>
  );
}

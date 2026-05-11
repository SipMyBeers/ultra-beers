import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import "server-only";
import { readConfig } from "./config";

export type Repo = {
  id: string;
  name: string;
  path: string;
  slug?: string; // "owner/repo"
  defaultBranch?: string;
  currentBranch?: string;
  dirty?: boolean;
  lastCommit?: { sha: string; subject: string; ageSeconds: number };
};

export type RepoIssue = {
  number: number;
  title: string;
  body?: string;
  url: string;
  author?: string;
  labels?: string[];
  state: string;
  updatedAt?: string;
};

function isValidRepoId(id: string): boolean {
  return /^[a-z0-9._-]+$/i.test(id);
}

export async function listRepos(): Promise<Repo[]> {
  const config = await readConfig();
  const roots = config.repoRoots ?? [];
  const seenIds = new Set<string>();
  const repos: Repo[] = [];

  for (const root of roots) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(root.path, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const full = path.join(root.path, e.name);
      const gitDir = path.join(full, ".git");
      try {
        const stat = await fs.stat(gitDir);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }
      const repo = await readRepoMeta(full, e.name, seenIds);
      if (repo) {
        seenIds.add(repo.id);
        repos.push(repo);
      }
    }
  }

  repos.sort((a, b) => {
    const aAge = a.lastCommit?.ageSeconds ?? Number.POSITIVE_INFINITY;
    const bAge = b.lastCommit?.ageSeconds ?? Number.POSITIVE_INFINITY;
    return aAge - bAge;
  });

  return repos;
}

async function readRepoMeta(
  repoPath: string,
  folderName: string,
  seenIds: Set<string>,
): Promise<Repo | null> {
  const id = uniqueId(folderName, seenIds);
  if (!isValidRepoId(id)) return null;

  const [remoteUrl, currentBranch, lastCommit, dirty] = await Promise.all([
    gitOutput(["config", "--get", "remote.origin.url"], repoPath),
    gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], repoPath),
    gitLastCommit(repoPath),
    gitDirty(repoPath),
  ]);

  const slug = parseGithubSlug(remoteUrl);

  return {
    id,
    name: folderName,
    path: repoPath,
    slug,
    currentBranch: currentBranch || undefined,
    dirty,
    lastCommit,
  };
}

function uniqueId(base: string, seen: Set<string>): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 48);
  if (!seen.has(slug)) return slug;
  let i = 2;
  while (seen.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

function parseGithubSlug(remote: string): string | undefined {
  if (!remote) return undefined;
  // git@github.com:owner/repo.git OR https://github.com/owner/repo(.git)?
  const ssh = remote.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  const https = remote.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\?|$)/);
  if (https) return `${https[1]}/${https[2]}`;
  return undefined;
}

function gitOutput(args: string[], cwd: string, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, timeoutMs);
    child.stdout?.on("data", (b) => (out += b.toString()));
    child.on("error", () => {
      clearTimeout(t);
      resolve("");
    });
    child.on("close", () => {
      clearTimeout(t);
      resolve(out.trim());
    });
  });
}

async function gitLastCommit(cwd: string): Promise<Repo["lastCommit"]> {
  const out = await gitOutput(["log", "-1", "--pretty=format:%H%x00%s%x00%ct"], cwd);
  if (!out) return undefined;
  const [sha, subject, ctStr] = out.split("\x00");
  const ct = Number(ctStr);
  if (!sha || Number.isNaN(ct)) return undefined;
  return {
    sha: sha.slice(0, 7),
    subject: subject || "",
    ageSeconds: Math.max(0, Math.floor(Date.now() / 1000 - ct)),
  };
}

async function gitDirty(cwd: string): Promise<boolean> {
  const out = await gitOutput(["status", "--porcelain"], cwd);
  return out.length > 0;
}

export type DecisionPoint = {
  source: "README" | "ROADMAP" | "TODO" | "PLAN" | "CHANGELOG";
  type: "heading" | "task" | "marker";
  text: string;
  context: string;
  lineNumber: number;
};

export type RepoOverview = {
  repo: Repo;
  recentCommits: Array<{ sha: string; subject: string; author: string; ageSeconds: number }>;
  dirtyFiles: string[];
  readme: { name: string; content: string } | null;
  roadmap: { name: string; content: string } | null;
  decisionPoints: DecisionPoint[];
  linkedVaultNotes: Array<{ vaultId: string; vaultLabel: string; path: string }>;
};

const ROADMAP_CANDIDATES = ["ROADMAP.md", "ROADMAP.markdown", "TODO.md", "PLAN.md", "TASKS.md"];
const README_CANDIDATES = ["README.md", "README.markdown", "readme.md", "Readme.md"];

export async function getRepoOverview(id: string): Promise<RepoOverview | null> {
  if (!isValidRepoId(id)) return null;
  const repos = await listRepos();
  const repo = repos.find((r) => r.id === id);
  if (!repo) return null;

  const [recentCommits, dirtyFiles, readme, roadmap, linkedVaultNotes] = await Promise.all([
    gitRecentCommits(repo.path, 10),
    gitDirtyFiles(repo.path),
    findFirstFile(repo.path, README_CANDIDATES),
    findFirstFile(repo.path, ROADMAP_CANDIDATES),
    findLinkedVaultNotes(repo.name),
  ]);

  const decisionPoints: DecisionPoint[] = [];
  if (readme) decisionPoints.push(...detectDecisionPoints(readme.content, "README"));
  if (roadmap) {
    const src = mapRoadmapSource(roadmap.name);
    decisionPoints.push(...detectDecisionPoints(roadmap.content, src));
  }

  return {
    repo,
    recentCommits,
    dirtyFiles,
    readme,
    roadmap,
    decisionPoints,
    linkedVaultNotes,
  };
}

function mapRoadmapSource(filename: string): DecisionPoint["source"] {
  const upper = filename.toUpperCase();
  if (upper.startsWith("TODO")) return "TODO";
  if (upper.startsWith("PLAN")) return "PLAN";
  if (upper.startsWith("CHANGELOG")) return "CHANGELOG";
  return "ROADMAP";
}

async function findFirstFile(
  repoPath: string,
  names: string[],
): Promise<{ name: string; content: string } | null> {
  for (const n of names) {
    const full = path.join(repoPath, n);
    try {
      const content = await fs.readFile(full, "utf8");
      return { name: n, content };
    } catch {
      // try next
    }
  }
  return null;
}

async function gitRecentCommits(
  cwd: string,
  n: number,
): Promise<RepoOverview["recentCommits"]> {
  const out = await gitOutput(
    ["log", `-n${n}`, "--pretty=format:%H%x00%s%x00%an%x00%ct"],
    cwd,
  );
  if (!out) return [];
  const now = Math.floor(Date.now() / 1000);
  return out
    .split("\n")
    .map((line) => {
      const [sha, subject, author, ctStr] = line.split("\x00");
      const ct = Number(ctStr);
      if (!sha || Number.isNaN(ct)) return null;
      return {
        sha: sha.slice(0, 7),
        subject: subject ?? "",
        author: author ?? "",
        ageSeconds: Math.max(0, now - ct),
      };
    })
    .filter(Boolean) as RepoOverview["recentCommits"];
}

async function gitDirtyFiles(cwd: string): Promise<string[]> {
  const out = await gitOutput(["status", "--porcelain"], cwd);
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);
}

async function findLinkedVaultNotes(
  repoName: string,
): Promise<Array<{ vaultId: string; vaultLabel: string; path: string }>> {
  const { readConfig } = await import("./config");
  const { scanVault } = await import("./vault");
  const config = await readConfig();
  const out: Array<{ vaultId: string; vaultLabel: string; path: string }> = [];
  const needle = repoName.toLowerCase();
  for (const vault of config.vaults) {
    try {
      const entries = await scanVault(vault.path, 5);
      for (const entry of flattenEntries(entries)) {
        if (entry.path.toLowerCase().includes(needle)) {
          out.push({ vaultId: vault.id, vaultLabel: vault.label, path: entry.path });
          if (out.length >= 20) return out;
        }
      }
    } catch {
      // ignore vault read errors
    }
  }
  return out;
}

function flattenEntries(
  entries: Array<{ name: string; path: string; type: "file" | "dir"; children?: unknown[] }>,
): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = [];
  const walk = (es: typeof entries) => {
    for (const e of es) {
      if (e.type === "file") out.push({ path: e.path, name: e.name });
      if (e.type === "dir" && Array.isArray(e.children)) {
        walk(e.children as typeof entries);
      }
    }
  };
  walk(entries);
  return out;
}

function detectDecisionPoints(
  content: string,
  source: DecisionPoint["source"],
): DecisionPoint[] {
  const lines = content.split("\n");
  const points: DecisionPoint[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Headings beginning with "decision" or ending with "?"
    const headingMatch = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch) {
      const text = headingMatch[2].trim();
      const lc = text.toLowerCase();
      const looksLikeDecision =
        lc.startsWith("decision:") ||
        lc.includes("decide ") ||
        lc.endsWith("?") ||
        /\b(tbd|todo|open question|unknown|undecided)\b/i.test(text);
      if (looksLikeDecision) {
        points.push({
          source,
          type: "heading",
          text,
          context: captureContext(lines, i, headingMatch[1].length),
          lineNumber: i + 1,
        });
        continue;
      }
    }

    // Unchecked task items with decision-y keywords
    const taskMatch = trimmed.match(/^[-*+]\s+\[\s\]\s+(.+)$/);
    if (taskMatch) {
      const text = taskMatch[1].trim();
      const lc = text.toLowerCase();
      if (
        lc.includes("decide") ||
        lc.endsWith("?") ||
        /\b(tbd|tba|undecided)\b/i.test(text)
      ) {
        points.push({
          source,
          type: "task",
          text,
          context: text,
          lineNumber: i + 1,
        });
      }
      continue;
    }

    // Inline markers
    if (/\b(TBD|TODO|FIXME|XXX)\b:?/.test(trimmed) && !trimmed.startsWith("#")) {
      const m = trimmed.match(/(TBD|TODO|FIXME|XXX):?\s*(.+)/i);
      if (m && m[2] && m[2].length > 4) {
        points.push({
          source,
          type: "marker",
          text: m[2].slice(0, 200),
          context: m[2].slice(0, 400),
          lineNumber: i + 1,
        });
      }
    }
  }

  // Dedupe by text after lowercase + trim, cap at 25
  const seen = new Set<string>();
  return points
    .filter((p) => {
      const k = p.text.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 25);
}

function captureContext(lines: string[], startIdx: number, headingLevel: number): string {
  const headingMarker = "#".repeat(headingLevel);
  const out: string[] = [];
  for (let i = startIdx + 1; i < lines.length && out.length < 8; i++) {
    const line = lines[i];
    if (/^#{1,6}\s/.test(line.trim()) && line.trim().startsWith(headingMarker)) break;
    if (/^#{1,6}\s/.test(line.trim()) && line.trim().length <= headingMarker.length + 1) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

export async function getRepoIssues(id: string): Promise<RepoIssue[] | null> {
  if (!isValidRepoId(id)) return null;
  const repos = await listRepos();
  const repo = repos.find((r) => r.id === id);
  if (!repo) return null;
  if (!repo.slug) return [];

  const out = await ghJson(
    [
      "issue",
      "list",
      "--repo",
      repo.slug,
      "--state",
      "open",
      "--limit",
      "30",
      "--json",
      "number,title,body,url,author,labels,state,updatedAt",
    ],
    repo.path,
    20_000,
  );
  if (!out) return [];

  try {
    const parsed = JSON.parse(out) as Array<{
      number: number;
      title: string;
      body?: string;
      url: string;
      author?: { login?: string };
      labels?: Array<{ name?: string }>;
      state?: string;
      updatedAt?: string;
    }>;
    return parsed.map((p) => ({
      number: p.number,
      title: p.title,
      body: p.body,
      url: p.url,
      author: p.author?.login,
      labels: (p.labels ?? []).map((l) => l.name).filter(Boolean) as string[],
      state: p.state ?? "open",
      updatedAt: p.updatedAt,
    }));
  } catch {
    return [];
  }
}

function ghJson(args: string[], cwd: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("gh", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env },
    });
    let out = "";
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, timeoutMs);
    child.stdout?.on("data", (b) => (out += b.toString()));
    child.on("error", () => {
      clearTimeout(t);
      resolve("");
    });
    child.on("close", () => {
      clearTimeout(t);
      resolve(out);
    });
  });
}

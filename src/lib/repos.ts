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

import "server-only";
import { getRepoOverview, listRepos, type DecisionPoint } from "./repos";
import { listDecisions } from "./decisions";

export type InboxItem = {
  id: string;
  repoId: string;
  repoName: string;
  repoSlug?: string;
  point: DecisionPoint;
  repoLastCommitAgeSeconds?: number;
};

export type InboxSummary = {
  pendingManualDecisions: number;
  items: InboxItem[];
  scannedRepos: number;
  skippedInactive: number;
};

const ACTIVE_THRESHOLD_SECONDS = 90 * 24 * 60 * 60; // 90 days
const MAX_REPOS = 25;
const MAX_ITEMS = 80;

export async function buildInbox(): Promise<InboxSummary> {
  const [repos, decisions] = await Promise.all([listRepos(), listDecisions()]);

  const active = repos.filter((r) => {
    const age = r.lastCommit?.ageSeconds;
    return age !== undefined && age < ACTIVE_THRESHOLD_SECONDS;
  });
  const candidates = active.slice(0, MAX_REPOS);

  const overviews = await Promise.all(
    candidates.map(async (r) => {
      try {
        return await getRepoOverview(r.id);
      } catch {
        return null;
      }
    }),
  );

  const items: InboxItem[] = [];
  for (const overview of overviews) {
    if (!overview) continue;
    const r = overview.repo;
    for (const point of overview.decisionPoints) {
      items.push({
        id: `${r.id}::${point.source}::${point.lineNumber}::${slug(point.text)}`,
        repoId: r.id,
        repoName: r.name,
        repoSlug: r.slug,
        point,
        repoLastCommitAgeSeconds: r.lastCommit?.ageSeconds,
      });
      if (items.length >= MAX_ITEMS) break;
    }
    if (items.length >= MAX_ITEMS) break;
  }

  // Rank: heading > task > marker; younger commit age first.
  const typeRank = { heading: 0, task: 1, marker: 2 } as const;
  items.sort((a, b) => {
    const tDiff = typeRank[a.point.type] - typeRank[b.point.type];
    if (tDiff !== 0) return tDiff;
    return (a.repoLastCommitAgeSeconds ?? Infinity) - (b.repoLastCommitAgeSeconds ?? Infinity);
  });

  return {
    pendingManualDecisions: decisions.filter((d) => d.status === "pending").length,
    items,
    scannedRepos: candidates.length,
    skippedInactive: repos.length - candidates.length,
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

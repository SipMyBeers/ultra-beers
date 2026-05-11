import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type Peer = {
  id: string;
  label: string;
  summary?: string;
  cwd?: string;
  color?: string;
  lastSeen?: string;
  pid?: number;
  tty?: string;
};

export type PeerRegistry = {
  peers: Peer[];
  syncedAt?: string;
};

const ROOT = path.join(os.homedir(), ".ultra-beers");
const REGISTRY = path.join(ROOT, "peers.json");

// Color cycle for auto-assignment if no color set.
const PALETTE = [
  "var(--peer-1)",
  "var(--peer-2)",
  "var(--peer-3)",
  "var(--peer-4)",
  "var(--peer-5)",
  "var(--peer-6)",
];

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function readRegistry(): Promise<PeerRegistry> {
  await ensureRoot();
  try {
    const raw = await fs.readFile(REGISTRY, "utf8");
    const parsed = JSON.parse(raw) as PeerRegistry;
    if (!Array.isArray(parsed.peers)) return { peers: [] };
    return parsed;
  } catch {
    return { peers: [] };
  }
}

export async function writeRegistry(registry: PeerRegistry): Promise<void> {
  await ensureRoot();
  const peers = registry.peers.map((p, i) => ({
    ...p,
    color: p.color || PALETTE[i % PALETTE.length],
  }));
  const payload: PeerRegistry = {
    peers,
    syncedAt: registry.syncedAt || new Date().toISOString(),
  };
  await fs.writeFile(REGISTRY, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export async function upsertPeer(input: Peer): Promise<Peer> {
  const registry = await readRegistry();
  const idx = registry.peers.findIndex((p) => p.id === input.id);
  if (idx >= 0) {
    registry.peers[idx] = { ...registry.peers[idx], ...input };
  } else {
    registry.peers.push(input);
  }
  registry.syncedAt = new Date().toISOString();
  await writeRegistry(registry);
  return registry.peers.find((p) => p.id === input.id)!;
}

export async function syncPeers(incoming: Peer[]): Promise<PeerRegistry> {
  const registry = await readRegistry();
  const existingById = new Map(registry.peers.map((p) => [p.id, p]));
  const merged: Peer[] = [];

  for (const peer of incoming) {
    const prior = existingById.get(peer.id);
    merged.push({
      ...prior,
      ...peer,
      color: peer.color || prior?.color,
    });
  }
  // Preserve peers that weren't in the sync (manually added, dormant, etc.) but mark them stale.
  for (const p of registry.peers) {
    if (!incoming.find((i) => i.id === p.id)) {
      merged.push({ ...p });
    }
  }

  const next: PeerRegistry = { peers: merged, syncedAt: new Date().toISOString() };
  await writeRegistry(next);
  return next;
}

export function isPeerActive(peer: Peer, now = Date.now()): boolean {
  if (!peer.lastSeen) return false;
  const seenMs = Date.parse(peer.lastSeen);
  if (Number.isNaN(seenMs)) return false;
  return now - seenMs < 5 * 60 * 1000; // 5 min
}

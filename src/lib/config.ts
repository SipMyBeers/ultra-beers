import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type VaultConfig = {
  id: string;
  label: string;
  path: string;
};

export type Config = {
  vaults: VaultConfig[];
};

const ROOT = path.join(os.homedir(), ".ultra-beers");
const CONFIG_PATH = path.join(ROOT, "config.json");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

function expandPath(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

async function exists(p: string): Promise<boolean> {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function autoDetectVaults(): Promise<VaultConfig[]> {
  const candidates: Array<{ id: string; label: string; relativePath: string }> = [
    { id: "kool", label: "Kool", relativePath: "Documents/Kool" },
    { id: "brand-kits", label: "Brand Kits", relativePath: "Desktop/BRAND-KITS" },
  ];
  const out: VaultConfig[] = [];
  for (const c of candidates) {
    const full = path.join(os.homedir(), c.relativePath);
    if (await exists(full)) {
      out.push({ id: c.id, label: c.label, path: full });
    }
  }
  return out;
}

export async function readConfig(): Promise<Config> {
  await ensureRoot();
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    const vaults = Array.isArray(parsed.vaults) ? parsed.vaults : [];
    return { vaults: vaults.map(normalizeVault).filter(Boolean) as VaultConfig[] };
  } catch {
    const detected = await autoDetectVaults();
    if (detected.length > 0) {
      const config: Config = { vaults: detected };
      await writeConfig(config);
      return config;
    }
    return { vaults: [] };
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await ensureRoot();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function normalizeVault(v: Partial<VaultConfig>): VaultConfig | null {
  if (!v || typeof v.path !== "string" || !v.path.trim()) return null;
  const id = v.id && /^[a-z0-9-]+$/i.test(v.id) ? v.id : slug(v.label || v.path);
  return {
    id,
    label: v.label || id,
    path: expandPath(v.path),
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32) || "vault";
}

export async function getVault(id: string): Promise<VaultConfig | null> {
  const config = await readConfig();
  return config.vaults.find((v) => v.id === id) ?? null;
}

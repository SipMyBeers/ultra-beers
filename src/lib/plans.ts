import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type Plan = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

const ROOT = path.join(os.homedir(), ".ultra-beers", "plans");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

function planPath(id: string) {
  return path.join(ROOT, `${id}.md`);
}

function parsePlan(id: string, raw: string, mtimeMs: number): Plan {
  const lines = raw.split("\n");
  const firstHeading = lines.find((l) => l.startsWith("# "));
  const title = firstHeading ? firstHeading.slice(2).trim() : "Untitled";
  return { id, title, content: raw, updatedAt: mtimeMs };
}

export async function listPlans(): Promise<Plan[]> {
  await ensureRoot();
  const entries = await fs.readdir(ROOT);
  const plans: Plan[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const id = entry.replace(/\.md$/, "");
    const p = await readPlan(id);
    if (p) plans.push(p);
  }
  plans.sort((a, b) => b.updatedAt - a.updatedAt);
  return plans;
}

export async function readPlan(id: string): Promise<Plan | null> {
  await ensureRoot();
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  try {
    const fp = planPath(id);
    const [raw, stat] = await Promise.all([
      fs.readFile(fp, "utf8"),
      fs.stat(fp),
    ]);
    return parsePlan(id, raw, stat.mtimeMs);
  } catch {
    return null;
  }
}

export async function writePlan(id: string, content: string): Promise<Plan> {
  await ensureRoot();
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("invalid plan id");
  const fp = planPath(id);
  await fs.writeFile(fp, content, "utf8");
  const stat = await fs.stat(fp);
  return parsePlan(id, content, stat.mtimeMs);
}

export async function deletePlan(id: string): Promise<void> {
  await ensureRoot();
  if (!/^[a-z0-9-]+$/i.test(id)) return;
  try {
    await fs.unlink(planPath(id));
  } catch {
    // no-op
  }
}

export function newPlanId(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

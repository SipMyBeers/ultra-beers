import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type Plan = {
  id: string;
  title: string;
  content: string;
  cwd?: string;
  updatedAt: number;
};

const ROOT = path.join(os.homedir(), ".ultra-beers", "plans");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

function planPath(id: string) {
  return path.join(ROOT, `${id}.md`);
}

const FM_FENCE = "---";

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  if (!raw.startsWith(FM_FENCE + "\n") && !raw.startsWith(FM_FENCE + "\r\n")) {
    return { fm: {}, body: raw };
  }
  const lines = raw.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FM_FENCE) {
      end = i;
      break;
    }
  }
  if (end < 0) return { fm: {}, body: raw };

  const fm: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[m[1]] = value;
  }
  const bodyLines = lines.slice(end + 1);
  if (bodyLines.length > 0 && bodyLines[0] === "") bodyLines.shift();
  return { fm, body: bodyLines.join("\n") };
}

function serialize(fm: Record<string, string | undefined>, body: string): string {
  const entries = Object.entries(fm).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  ) as Array<[string, string]>;
  if (entries.length === 0) return body;
  const fmLines = entries.map(([k, v]) => `${k}: ${quoteIfNeeded(v)}`);
  return `${FM_FENCE}\n${fmLines.join("\n")}\n${FM_FENCE}\n\n${body.replace(/^\n+/, "")}`;
}

function quoteIfNeeded(v: string): string {
  if (/[#:>|&*!%@`{}[\],?]/.test(v) || /^\s|\s$/.test(v)) return JSON.stringify(v);
  return v;
}

function parsePlan(id: string, raw: string, mtimeMs: number): Plan {
  const { fm, body } = parseFrontmatter(raw);
  const firstHeading = body.split("\n").find((l) => l.startsWith("# "));
  const title = firstHeading ? firstHeading.slice(2).trim() : "Untitled";
  const cwd = fm.cwd && fm.cwd.length > 0 ? fm.cwd : undefined;
  return { id, title, content: body, cwd, updatedAt: mtimeMs };
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
    const [raw, stat] = await Promise.all([fs.readFile(fp, "utf8"), fs.stat(fp)]);
    return parsePlan(id, raw, stat.mtimeMs);
  } catch {
    return null;
  }
}

export async function writePlan(
  id: string,
  content: string,
  cwd?: string,
): Promise<Plan> {
  await ensureRoot();
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("invalid plan id");
  const fp = planPath(id);
  const raw = serialize({ cwd: cwd?.trim() || undefined }, content);
  await fs.writeFile(fp, raw, "utf8");
  const stat = await fs.stat(fp);
  return parsePlan(id, raw, stat.mtimeMs);
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

export function expandCwd(cwd: string | undefined | null): string | undefined {
  if (!cwd) return undefined;
  const trimmed = cwd.trim();
  if (!trimmed) return undefined;
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(trimmed);
}

export async function validateCwd(cwd: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const stat = await fs.stat(cwd);
    if (!stat.isDirectory()) return { ok: false, reason: "not a directory" };
    return { ok: true };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { ok: false, reason: "does not exist" };
    if (code === "EACCES") return { ok: false, reason: "permission denied" };
    return { ok: false, reason: (err as Error).message };
  }
}

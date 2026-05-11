import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type DecisionOption = { id: string; label: string };

export type Decision = {
  id: string;
  title: string;
  status: "pending" | "decided" | "skipped";
  context: string;
  options: DecisionOption[];
  chosenId?: string;
  note?: string;
  createdAt: number;
  decidedAt?: number;
  raw: string;
};

const ROOT = path.join(os.homedir(), ".ultra-beers", "decisions");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

function decisionPath(id: string) {
  return path.join(ROOT, `${id}.md`);
}

const FM_FENCE = "---";

function splitFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
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
    const m = lines[i].match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
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

function quoteIfNeeded(v: string): string {
  if (/[#:>|&*!%@`{}[\],?]/.test(v) || /^\s|\s$/.test(v)) return JSON.stringify(v);
  return v;
}

function buildRaw(input: {
  status: Decision["status"];
  createdAt: number;
  decidedAt?: number;
  chosenId?: string;
  note?: string;
  title: string;
  context: string;
  options: DecisionOption[];
}): string {
  const fm: Record<string, string | undefined> = {
    status: input.status,
    created_at: new Date(input.createdAt).toISOString(),
    decided_at: input.decidedAt ? new Date(input.decidedAt).toISOString() : undefined,
    chosen: input.chosenId,
  };

  const fmLines = Object.entries(fm)
    .filter(([, v]) => typeof v === "string" && v.length > 0)
    .map(([k, v]) => `${k}: ${quoteIfNeeded(v as string)}`);

  const optionsBlock = input.options
    .map((o) => `- **${o.id}**: ${o.label}`)
    .join("\n");

  const decidedBlock =
    input.chosenId && input.status === "decided"
      ? `**${input.chosenId}**${input.note ? `\n\n${input.note}` : ""}`
      : "_pending_";

  return `${FM_FENCE}\n${fmLines.join("\n")}\n${FM_FENCE}\n\n# ${input.title}\n\n## Context\n\n${input.context.trim() || "_no context yet_"}\n\n## Options\n\n${optionsBlock}\n\n## Decision\n\n${decidedBlock}\n`;
}

function parseDecision(id: string, raw: string, stat: { mtimeMs: number }): Decision {
  const { fm, body } = splitFrontmatter(raw);
  const lines = body.split("\n");

  const titleLine = lines.find((l) => l.startsWith("# "));
  const title = titleLine ? titleLine.slice(2).trim() : "Untitled decision";

  const sections = splitSections(body);
  const context = (sections["Context"] || "").trim();
  const optionsRaw = (sections["Options"] || "").trim();
  const decisionRaw = (sections["Decision"] || "").trim();

  const options: DecisionOption[] = [];
  for (const line of optionsRaw.split("\n")) {
    const m = line.match(/^-\s*\*\*([a-zA-Z0-9_-]+)\*\*\s*:\s*(.*)$/);
    if (m) options.push({ id: m[1], label: m[2].trim() });
  }

  const status = (fm.status as Decision["status"]) || "pending";
  const chosenIdFromFm = fm.chosen;
  let chosenId: string | undefined = chosenIdFromFm;
  let note: string | undefined;

  if (!chosenId && decisionRaw && decisionRaw !== "_pending_") {
    const chosenMatch = decisionRaw.match(/^\*\*([a-zA-Z0-9_-]+)\*\*/);
    if (chosenMatch) chosenId = chosenMatch[1];
  }
  if (chosenId) {
    const after = decisionRaw.replace(/^\*\*[a-zA-Z0-9_-]+\*\*\s*/, "").trim();
    if (after && after !== "_pending_") note = after;
  }

  const createdAt = fm.created_at ? Date.parse(fm.created_at) : stat.mtimeMs;
  const decidedAt = fm.decided_at ? Date.parse(fm.decided_at) : undefined;

  return {
    id,
    title,
    status,
    context,
    options,
    chosenId,
    note,
    createdAt,
    decidedAt,
    raw,
  };
}

function splitSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split("\n");
  let current: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current) sections[current] = buf.join("\n");
      current = m[1].trim();
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current) sections[current] = buf.join("\n");
  return sections;
}

export async function listDecisions(): Promise<Decision[]> {
  await ensureRoot();
  const entries = await fs.readdir(ROOT);
  const decisions: Decision[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const id = entry.replace(/\.md$/, "");
    const d = await readDecision(id);
    if (d) decisions.push(d);
  }
  decisions.sort((a, b) => {
    // pending first, then by createdAt descending
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.createdAt - a.createdAt;
  });
  return decisions;
}

export async function readDecision(id: string): Promise<Decision | null> {
  await ensureRoot();
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  try {
    const fp = decisionPath(id);
    const [raw, stat] = await Promise.all([fs.readFile(fp, "utf8"), fs.stat(fp)]);
    return parseDecision(id, raw, stat);
  } catch {
    return null;
  }
}

export async function createDecision(input: {
  id?: string;
  title: string;
  context: string;
  options: DecisionOption[];
}): Promise<Decision> {
  await ensureRoot();
  const id = input.id && /^[a-z0-9-]+$/i.test(input.id) ? input.id : newDecisionId();
  const now = Date.now();
  const raw = buildRaw({
    status: "pending",
    createdAt: now,
    title: input.title,
    context: input.context,
    options: input.options,
  });
  await fs.writeFile(decisionPath(id), raw, "utf8");
  return parseDecision(id, raw, { mtimeMs: now });
}

export async function decideDecision(
  id: string,
  chosenId: string,
  note?: string,
): Promise<Decision | null> {
  const existing = await readDecision(id);
  if (!existing) return null;
  const optionExists = existing.options.some((o) => o.id === chosenId);
  if (!optionExists && chosenId !== "skip") return null;

  const now = Date.now();
  const status: Decision["status"] = chosenId === "skip" ? "skipped" : "decided";
  const raw = buildRaw({
    status,
    createdAt: existing.createdAt,
    decidedAt: now,
    chosenId: chosenId === "skip" ? undefined : chosenId,
    note,
    title: existing.title,
    context: existing.context,
    options: existing.options,
  });
  await fs.writeFile(decisionPath(id), raw, "utf8");
  return parseDecision(id, raw, { mtimeMs: now });
}

export async function reopenDecision(id: string): Promise<Decision | null> {
  const existing = await readDecision(id);
  if (!existing) return null;
  const raw = buildRaw({
    status: "pending",
    createdAt: existing.createdAt,
    title: existing.title,
    context: existing.context,
    options: existing.options,
  });
  await fs.writeFile(decisionPath(id), raw, "utf8");
  return parseDecision(id, raw, { mtimeMs: Date.now() });
}

export async function deleteDecision(id: string): Promise<void> {
  await ensureRoot();
  if (!/^[a-z0-9-]+$/i.test(id)) return;
  try {
    await fs.unlink(decisionPath(id));
  } catch {
    // no-op
  }
}

export function newDecisionId(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

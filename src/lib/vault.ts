import { promises as fs } from "node:fs";
import path from "node:path";

export type VaultEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: VaultEntry[];
};

const SKIP_DIRS = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
  ".DS_Store",
  ".vscode",
  ".idea",
]);
const ALLOWED_EXTS = new Set([".md", ".markdown", ".mdx"]);

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isInsideOrEqual(child: string, parent: string): boolean {
  if (child === parent) return true;
  return isInside(child, parent);
}

export async function scanVault(rootPath: string, maxDepth = 6): Promise<VaultEntry[]> {
  return walk(rootPath, rootPath, 0, maxDepth);
}

async function walk(
  dir: string,
  root: string,
  depth: number,
  maxDepth: number,
): Promise<VaultEntry[]> {
  if (depth > maxDepth) return [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: VaultEntry[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const children = await walk(full, root, depth + 1, maxDepth);
      if (children.length > 0) {
        out.push({
          name: e.name,
          path: path.relative(root, full),
          type: "dir",
          children,
        });
      }
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      out.push({
        name: e.name,
        path: path.relative(root, full),
        type: "file",
      });
    }
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function readFileFromVault(
  vaultPath: string,
  relPath: string,
): Promise<{ content: string; mtimeMs: number } | null> {
  const root = path.resolve(vaultPath);
  const full = path.resolve(vaultPath, relPath);
  if (!isInsideOrEqual(full, root)) return null;
  const ext = path.extname(full).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) return null;
  try {
    const [content, stat] = await Promise.all([
      fs.readFile(full, "utf8"),
      fs.stat(full),
    ]);
    if (!stat.isFile()) return null;
    return { content, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

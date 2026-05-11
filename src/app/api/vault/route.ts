import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { readFileFromVault, scanVault } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vaultId = url.searchParams.get("vault");
  const filePath = url.searchParams.get("path");

  const config = await readConfig();

  if (!vaultId) {
    return NextResponse.json({
      vaults: config.vaults.map((v) => ({ id: v.id, label: v.label, path: v.path })),
    });
  }

  const vault = config.vaults.find((v) => v.id === vaultId);
  if (!vault) {
    return NextResponse.json({ error: "vault not found" }, { status: 404 });
  }

  if (!filePath) {
    const entries = await scanVault(vault.path);
    return NextResponse.json({
      vault: { id: vault.id, label: vault.label, path: vault.path },
      entries,
    });
  }

  const file = await readFileFromVault(vault.path, filePath);
  if (!file) {
    return NextResponse.json({ error: "file not found or not readable" }, { status: 404 });
  }
  return NextResponse.json({
    file: {
      path: filePath,
      content: file.content,
      mtimeMs: file.mtimeMs,
    },
  });
}

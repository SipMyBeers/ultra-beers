import { readConfig } from "@/lib/config";
import { scanVault } from "@/lib/vault";
import { VaultBrowser } from "@/components/VaultBrowser";

export const dynamic = "force-dynamic";

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string; path?: string }>;
}) {
  const { vault: vaultParam, path: pathParam } = await searchParams;
  const config = await readConfig();

  const activeVault =
    config.vaults.find((v) => v.id === vaultParam) ?? config.vaults[0] ?? null;

  const entries = activeVault ? await scanVault(activeVault.path) : [];

  return (
    <VaultBrowser
      vaults={config.vaults.map((v) => ({ id: v.id, label: v.label }))}
      activeVaultId={activeVault?.id ?? null}
      activeVaultPath={activeVault?.path ?? null}
      entries={entries}
      initialFilePath={pathParam ?? null}
    />
  );
}

import { isPeerActive, readRegistry, type Peer } from "@/lib/peers";

function relTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export async function PeersPane() {
  const registry = await readRegistry();
  const peers = registry.peers;

  return (
    <section style={{ marginBottom: 28 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h2 style={{ color: "var(--magenta)", margin: 0 }}>colony</h2>
        <span style={{ fontSize: 9, fontFamily: "var(--font-pixel)", color: "var(--fg-faint)" }}>
          {peers.length === 0
            ? "no peers — run /ultrabridge to sync"
            : `${peers.length} peer${peers.length === 1 ? "" : "s"} · synced ${relTime(registry.syncedAt)}`}
        </span>
      </header>

      {peers.length === 0 ? (
        <div
          className="pixel-card flat"
          style={{
            padding: 18,
            textAlign: "center",
            color: "var(--fg-faint)",
            fontFamily: "var(--font-crt)",
            fontSize: 14,
          }}
        >
          claude-peers MCP not synced yet. From any Claude Code session, run{" "}
          <code style={{ color: "var(--lime)" }}>/ultrabridge sync</code>.
        </div>
      ) : (
        <ul style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {peers.map((p) => (
            <PeerCard key={p.id} peer={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PeerCard({ peer }: { peer: Peer }) {
  const active = isPeerActive(peer);
  const color = peer.color || "var(--cyan)";
  return (
    <li
      className="pixel-card flat"
      style={{ padding: "10px 12px", position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          className="peer-chip"
          style={
            { "--peer-color": color } as React.CSSProperties
          }
        >
          {peer.label}
        </span>
        <span style={{ fontSize: 9, fontFamily: "var(--font-pixel)", color: "var(--fg-faint)" }}>
          <span className={`status-dot${active ? "" : " stale"}`} />
          {active ? "live" : relTime(peer.lastSeen)}
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--fg-dim)",
          margin: 0,
          minHeight: 28,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {peer.summary || (
          <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>no summary</span>
        )}
      </p>
    </li>
  );
}

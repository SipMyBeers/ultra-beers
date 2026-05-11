import Link from "next/link";
import { listPlans } from "@/lib/plans";
import { listDecisions } from "@/lib/decisions";
import { NewPlanButton } from "@/components/NewPlanButton";
import { TopNav } from "@/components/TopNav";
import { PeersPane } from "@/components/PeersPane";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [plans, decisions] = await Promise.all([listPlans(), listDecisions()]);
  const pendingDecisions = decisions.filter((d) => d.status === "pending").length;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 80px" }}>
      <TopNav active="plans" />

      <PeersPane />

      <div className="pixel-divider" />

      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 8,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ color: "var(--accent)", margin: 0 }}>plans</h1>
          <p
            style={{
              color: "var(--fg-dim)",
              fontSize: 12,
              fontFamily: "var(--font-crt)",
              marginTop: 2,
              letterSpacing: 0.4,
            }}
          >
            three local agents critique your plan in parallel.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingDecisions > 0 && (
            <Link
              href="/decisions"
              style={{
                fontSize: 10,
                fontFamily: "var(--font-pixel)",
                color: "var(--magenta)",
                border: "2px solid var(--magenta)",
                padding: "5px 10px",
                textShadow: "0 0 6px rgba(255, 119, 168, 0.5)",
                letterSpacing: 0.8,
              }}
            >
              {pendingDecisions} pending →
            </Link>
          )}
          <NewPlanButton />
        </div>
      </header>

      {plans.length === 0 ? (
        <div
          className="pixel-card flat"
          style={{
            padding: 36,
            textAlign: "center",
            color: "var(--fg-dim)",
          }}
        >
          <p style={{ fontFamily: "var(--font-crt)", fontSize: 18, marginBottom: 4 }}>
            no plans yet
          </p>
          <p style={{ fontSize: 11, color: "var(--fg-faint)" }}>
            write a plan, refine it with parallel local Claude agents, ship.
          </p>
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/plan/${p.id}`} className="pixel-card flat" style={planRowStyle}>
                <span style={{ fontWeight: 600, color: "var(--fg)" }}>{p.title}</span>
                <span
                  style={{
                    color: "var(--fg-faint)",
                    fontSize: 10,
                    fontFamily: "var(--font-pixel)",
                  }}
                >
                  {new Date(p.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer
        style={{
          marginTop: 48,
          paddingTop: 14,
          borderTop: "2px solid var(--border)",
          fontSize: 9,
          color: "var(--fg-faint)",
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-pixel)",
          letterSpacing: 0.8,
        }}
      >
        <span>
          plans · <code style={{ color: "var(--lime)" }}>~/.ultra-beers/</code>
        </span>
        <a
          href="https://github.com/SipMyBeers/ultra-beers"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--magenta)" }}
        >
          github
        </a>
      </footer>
    </main>
  );
}

const planRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  color: "var(--fg)",
  fontSize: 13,
  textShadow: "none",
};

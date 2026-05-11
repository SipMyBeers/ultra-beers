import Link from "next/link";
import { listPlans } from "@/lib/plans";
import { NewPlanButton } from "@/components/NewPlanButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const plans = await listPlans();

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>ultra-beers</h1>
          <p style={{ color: "var(--fg-dim)", fontSize: 14, marginTop: 4 }}>
            local plan refinement. your machine. your agents.
          </p>
        </div>
        <NewPlanButton />
      </header>

      {plans.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 10,
            padding: 48,
            textAlign: "center",
            color: "var(--fg-dim)",
          }}
        >
          <p style={{ fontSize: 14, marginBottom: 12 }}>No plans yet.</p>
          <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>
            Write a plan, refine it with parallel local Claude agents, ship.
          </p>
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/plan/${p.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--fg)",
                  fontSize: 14,
                }}
              >
                <span style={{ fontWeight: 500 }}>{p.title}</span>
                <span style={{ color: "var(--fg-faint)", fontSize: 12 }}>
                  {new Date(p.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--fg-faint)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          Plans live at <code style={{ fontSize: 11 }}>~/.ultra-beers/plans/</code>
        </span>
        <a href="https://github.com/SipMyBeers/ultra-beers" target="_blank" rel="noreferrer">
          github
        </a>
      </footer>
    </main>
  );
}

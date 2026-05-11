import Link from "next/link";
import { listPlans } from "@/lib/plans";
import { NewPlanButton } from "@/components/NewPlanButton";
import { TopNav } from "@/components/TopNav";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const plans = await listPlans();

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 80px" }}>
      <TopNav active="plans" />

      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4 }}>plans</h1>
          <p style={{ color: "var(--fg-dim)", fontSize: 13, marginTop: 2 }}>
            three local agents critique your plan in parallel.
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
          <p style={{ fontSize: 14, marginBottom: 6 }}>No plans yet.</p>
          <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>
            Write a plan, refine it with parallel local Claude agents, ship.
          </p>
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/plan/${p.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--fg)",
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 500 }}>{p.title}</span>
                <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>
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
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--fg-faint)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          plans live at <code>~/.ultra-beers/plans/</code>
        </span>
        <a href="https://github.com/SipMyBeers/ultra-beers" target="_blank" rel="noreferrer">
          github
        </a>
      </footer>
    </main>
  );
}

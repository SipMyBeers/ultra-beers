import Link from "next/link";
import { listDecisions } from "@/lib/decisions";
import { TopNav } from "@/components/TopNav";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const decisions = await listDecisions();
  const pending = decisions.filter((d) => d.status === "pending");
  const done = decisions.filter((d) => d.status !== "pending");

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 80px" }}>
      <TopNav active="decisions" />

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
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4 }}>
            decisions
          </h1>
          <p style={{ color: "var(--fg-dim)", fontSize: 13, marginTop: 2 }}>
            choose your own adventure. one click per decision, queue advances.
          </p>
        </div>
        {pending.length > 0 && (
          <Link
            href={`/decisions/${pending[0].id}`}
            style={{
              padding: "6px 14px",
              background: "var(--accent)",
              color: "#1a1004",
              fontWeight: 600,
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            start →
          </Link>
        )}
      </header>

      {decisions.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 10,
            padding: 48,
            textAlign: "center",
            color: "var(--fg-dim)",
          }}
        >
          <p style={{ fontSize: 14, marginBottom: 6 }}>No decisions queued.</p>
          <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>
            POST to <code>/api/decisions</code> with title, context, and 2–4 options.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={sectionTitleStyle}>pending · {pending.length}</h2>
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pending.map((d) => (
                  <li key={d.id}>
                    <Link href={`/decisions/${d.id}`} style={rowStyle}>
                      <span style={{ fontWeight: 500 }}>{d.title}</span>
                      <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>
                        {d.options.length} options
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 style={sectionTitleStyle}>decided · {done.length}</h2>
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {done.map((d) => (
                  <li key={d.id}>
                    <Link href={`/decisions/${d.id}`} style={{ ...rowStyle, opacity: 0.7 }}>
                      <span style={{ fontWeight: 500 }}>{d.title}</span>
                      <span
                        style={{
                          color:
                            d.status === "skipped" ? "var(--fg-faint)" : "var(--accent)",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {d.status === "skipped" ? "skipped" : `→ ${d.chosenId}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <footer
        style={{
          marginTop: 48,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--fg-faint)",
        }}
      >
        decisions live at <code>~/.ultra-beers/decisions/</code>
      </footer>
    </main>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "var(--fg-dim)",
  marginBottom: 8,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--fg)",
  fontSize: 13,
};

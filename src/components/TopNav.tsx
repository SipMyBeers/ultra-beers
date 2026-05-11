import Link from "next/link";

export function TopNav({ active }: { active: "plans" | "decisions" }) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        paddingBottom: 4,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: -0.3,
          marginRight: 16,
          color: "var(--fg)",
        }}
      >
        <Link href="/" style={{ color: "var(--fg)" }}>
          ultra-beers
        </Link>
      </span>
      <NavTab href="/" label="plans" active={active === "plans"} />
      <NavTab href="/decisions" label="decisions" active={active === "decisions"} />
    </nav>
  );
}

function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        color: active ? "var(--fg)" : "var(--fg-dim)",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: -5,
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}

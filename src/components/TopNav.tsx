import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function TopNav({ active }: { active: "plans" | "decisions" }) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingBottom: 12,
        borderBottom: "2px solid var(--border)",
      }}
    >
      <Link href="/" className="logo" style={{ marginRight: 16, textShadow: "none" }}>
        <span className="dot" />
        <span>ULTRA</span>
        <span className="beers">·BEERS</span>
      </Link>
      <Link href="/" className={`nav-tab ${active === "plans" ? "active" : ""}`}>
        plans
      </Link>
      <Link
        href="/decisions"
        className={`nav-tab ${active === "decisions" ? "active" : ""}`}
      >
        decisions
      </Link>
      <ThemeSwitcher />
    </nav>
  );
}

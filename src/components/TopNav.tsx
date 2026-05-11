import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";

type Active = "plans" | "decisions" | "vault" | "repos" | "inbox";

export function TopNav({ active }: { active: Active }) {
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
      <Link href="/inbox" className={`nav-tab ${active === "inbox" ? "active" : ""}`}>
        inbox
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
      <Link href="/vault" className={`nav-tab ${active === "vault" ? "active" : ""}`}>
        vault
      </Link>
      <Link href="/repos" className={`nav-tab ${active === "repos" ? "active" : ""}`}>
        repos
      </Link>
      <ThemeSwitcher />
    </nav>
  );
}

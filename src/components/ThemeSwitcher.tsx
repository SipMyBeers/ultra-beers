"use client";

import { useEffect, useState } from "react";

export const THEMES = [
  { id: "pixel", label: "Pixel" },
  { id: "minimal", label: "Minimal" },
  { id: "terminal", label: "Terminal" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "ub-theme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("pixel");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = document.documentElement.getAttribute("data-theme") as ThemeId | null;
    if (initial && THEMES.some((t) => t.id === initial)) setTheme(initial);
    setMounted(true);
  }, []);

  const choose = (next: ThemeId) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be blocked; the change still applies for this session.
    }
  };

  return (
    <div className="theme-switcher">
      <label htmlFor="ub-theme-select">theme</label>
      <select
        id="ub-theme-select"
        value={theme}
        onChange={(e) => choose(e.target.value as ThemeId)}
        suppressHydrationWarning
        aria-label="UI theme"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {mounted ? t.label : t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

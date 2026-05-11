import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ultra-beers — local plan refinement",
  description:
    "Open-source local-first plan refinement. Like /ultraplan but running on your own machine via local Claude Code agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

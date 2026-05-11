import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Press_Start_2P, VT323 } from "next/font/google";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ultra-beers",
  description:
    "Open-source local-first plan refinement + decision queue. Like /ultraplan but on your own machine, dispatched to local Claude Code agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart.variable} ${vt323.variable}`} data-theme="pixel">
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}

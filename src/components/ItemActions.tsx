"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DecisionOptionSpec = { id: string; label: string };

const DEFAULT_OPTIONS: DecisionOptionSpec[] = [
  { id: "yes", label: "Yes — proceed" },
  { id: "no", label: "No — drop or defer" },
  { id: "modify", label: "Modify — change scope first" },
  { id: "spike", label: "Spike — investigate before deciding" },
];

export function ItemActions({
  title,
  context,
  size = "sm",
  decisionOptions = DEFAULT_OPTIONS,
  planTitle,
}: {
  title: string;
  context: string;
  size?: "sm" | "md";
  decisionOptions?: DecisionOptionSpec[];
  planTitle?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "plan" | "decide">(null);

  const fontSize = size === "md" ? 11 : 9;
  const padding = size === "md" ? "5px 12px" : "3px 8px";

  const planThis = async () => {
    setBusy("plan");
    try {
      const heading = (planTitle ?? title).trim();
      const content = `# ${heading}

## Context

${context.trim()}

## Steps

1.
2.
3.

## Verification

`;
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { plan?: { id: string } };
      if (data.plan?.id) router.push(`/plan/${data.plan.id}`);
    } finally {
      setBusy(null);
    }
  };

  const decideThis = async () => {
    setBusy("decide");
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          context: context.trim(),
          options: decisionOptions,
        }),
      });
      const data = (await res.json()) as { decision?: { id: string } };
      if (data.decision?.id) router.push(`/decisions/${data.decision.id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button
        onClick={planThis}
        disabled={busy !== null}
        className="ghost"
        style={{ fontSize, padding }}
      >
        {busy === "plan" ? "…" : "plan"}
      </button>
      <button
        onClick={decideThis}
        disabled={busy !== null}
        className="ghost"
        style={{ fontSize, padding }}
      >
        {busy === "decide" ? "…" : "decide"}
      </button>
    </div>
  );
}

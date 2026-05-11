"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewPlanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/plans", { method: "POST" });
      const data = (await res.json()) as { plan?: { id: string } };
      if (data.plan?.id) router.push(`/plan/${data.plan.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="primary" onClick={create} disabled={busy}>
      {busy ? "Creating…" : "+ new plan"}
    </button>
  );
}

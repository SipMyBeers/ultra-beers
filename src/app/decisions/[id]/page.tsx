import { notFound } from "next/navigation";
import { listDecisions, readDecision } from "@/lib/decisions";
import { DecisionChooser } from "@/components/DecisionChooser";

export const dynamic = "force-dynamic";

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decision = await readDecision(id);
  if (!decision) notFound();

  const all = await listDecisions();
  const pending = all.filter((d) => d.status === "pending");
  const idx = pending.findIndex((d) => d.id === id);
  const next = idx >= 0 && idx + 1 < pending.length ? pending[idx + 1] : null;
  const remaining = pending.length;

  return (
    <DecisionChooser decision={decision} nextId={next?.id ?? null} remaining={remaining} />
  );
}

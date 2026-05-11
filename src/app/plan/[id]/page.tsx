import { notFound } from "next/navigation";
import { readPlan } from "@/lib/plans";
import { PlanWorkspace } from "@/components/PlanWorkspace";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await readPlan(id);
  if (!plan) notFound();
  return <PlanWorkspace initialPlan={plan} />;
}

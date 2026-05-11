import { NextResponse } from "next/server";
import { listPlans, newPlanId, writePlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await listPlans();
  return NextResponse.json({
    plans: plans.map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const id = newPlanId();
  const initial =
    typeof body.content === "string" && body.content.length > 0
      ? body.content
      : `# Untitled plan\n\nDescribe what you want to do. Refine with the agents on the right.\n\n## Context\n\n## Steps\n\n1. \n2. \n3. \n\n## Verification\n\n`;
  const plan = await writePlan(id, initial);
  return NextResponse.json({ plan });
}

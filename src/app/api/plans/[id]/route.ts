import { NextResponse } from "next/server";
import { deletePlan, readPlan, writePlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await readPlan(id);
  if (!plan) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { content?: string };
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const plan = await writePlan(id, body.content);
  return NextResponse.json({ plan });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletePlan(id);
  return NextResponse.json({ ok: true });
}

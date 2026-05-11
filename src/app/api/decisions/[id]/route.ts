import { NextResponse } from "next/server";
import {
  decideDecision,
  deleteDecision,
  readDecision,
  reopenDecision,
} from "@/lib/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decision = await readDecision(id);
  if (!decision) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ decision });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "decide" | "skip" | "reopen";
    chosenId?: string;
    note?: string;
  };

  if (body.action === "reopen") {
    const decision = await reopenDecision(id);
    if (!decision) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ decision });
  }

  if (body.action === "skip") {
    const decision = await decideDecision(id, "skip");
    if (!decision) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ decision });
  }

  if (body.action === "decide") {
    if (!body.chosenId) {
      return NextResponse.json({ error: "chosenId required" }, { status: 400 });
    }
    const decision = await decideDecision(id, body.chosenId, body.note);
    if (!decision) {
      return NextResponse.json(
        { error: "decision not found or option invalid" },
        { status: 404 },
      );
    }
    return NextResponse.json({ decision });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteDecision(id);
  return NextResponse.json({ ok: true });
}

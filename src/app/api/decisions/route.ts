import { NextResponse } from "next/server";
import {
  createDecision,
  listDecisions,
  type DecisionOption,
} from "@/lib/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const decisions = await listDecisions();
  return NextResponse.json({
    decisions: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      chosenId: d.chosenId,
      createdAt: d.createdAt,
      decidedAt: d.decidedAt,
      optionCount: d.options.length,
    })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    title?: string;
    context?: string;
    options?: DecisionOption[];
  };
  if (!body.title || !Array.isArray(body.options) || body.options.length < 2) {
    return NextResponse.json(
      { error: "title and at least 2 options required" },
      { status: 400 },
    );
  }
  const cleaned: DecisionOption[] = body.options
    .filter((o) => o && typeof o.id === "string" && typeof o.label === "string")
    .map((o) => ({ id: o.id.trim(), label: o.label.trim() }))
    .filter((o) => o.id.length > 0 && o.label.length > 0);

  if (cleaned.length < 2) {
    return NextResponse.json(
      { error: "at least 2 valid options required" },
      { status: 400 },
    );
  }

  const decision = await createDecision({
    id: body.id,
    title: body.title.trim(),
    context: (body.context || "").trim(),
    options: cleaned,
  });
  return NextResponse.json({ decision });
}

import { NextResponse } from "next/server";
import { getRepoIssues } from "@/lib/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issues = await getRepoIssues(id);
  if (issues === null) {
    return NextResponse.json({ error: "repo not found" }, { status: 404 });
  }
  return NextResponse.json({ issues });
}

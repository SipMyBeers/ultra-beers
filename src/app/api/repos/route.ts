import { NextResponse } from "next/server";
import { listRepos } from "@/lib/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const repos = await listRepos();
  return NextResponse.json({ repos });
}

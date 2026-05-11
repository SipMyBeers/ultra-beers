import { NextResponse } from "next/server";
import { buildInbox } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const inbox = await buildInbox();
  return NextResponse.json(inbox);
}

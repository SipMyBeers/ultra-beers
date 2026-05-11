import { NextResponse } from "next/server";
import { readRegistry, syncPeers, upsertPeer, type Peer } from "@/lib/peers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const registry = await readRegistry();
  return NextResponse.json(registry);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: "sync" | "upsert";
    peer?: Peer;
    peers?: Peer[];
  };

  if (body.action === "sync") {
    const incoming = Array.isArray(body.peers) ? body.peers : [];
    const cleaned = incoming
      .filter((p) => p && typeof p.id === "string")
      .map<Peer>((p) => ({
        id: p.id,
        label: p.label || p.id,
        summary: p.summary,
        cwd: p.cwd,
        color: p.color,
        lastSeen: p.lastSeen,
        pid: p.pid,
        tty: p.tty,
      }));
    const registry = await syncPeers(cleaned);
    return NextResponse.json(registry);
  }

  if (body.peer) {
    const peer = await upsertPeer(body.peer);
    return NextResponse.json({ peer });
  }

  return NextResponse.json({ error: "specify action=sync or include peer" }, { status: 400 });
}

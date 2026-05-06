import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min, since the agent can take longer

export async function POST(req: NextRequest) {
  // Auth: Supabase magic-link session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sidecarUrl = process.env.NEXT_PUBLIC_SIDECAR_URL;
  const secret = process.env.SIDECAR_SHARED_SECRET;
  if (!sidecarUrl || !secret) {
    return NextResponse.json(
      { error: "Sidecar not configured (NEXT_PUBLIC_SIDECAR_URL or SIDECAR_SHARED_SECRET missing)" },
      { status: 503 },
    );
  }

  // Forward the message stream from the sidecar SSE endpoint.
  const upstreamRes = await fetch(`${sidecarUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: await req.text(),
    // @ts-expect-error: duplex is needed for streaming bodies
    duplex: "half",
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const txt = await upstreamRes.text().catch(() => upstreamRes.statusText);
    return NextResponse.json({ error: `Sidecar: ${txt}` }, { status: upstreamRes.status });
  }

  return new Response(upstreamRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

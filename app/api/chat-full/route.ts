import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const maxDuration = 300; // streaming responses on edge can run past static caps
export const dynamic = "force-dynamic";

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

  // Manually pump the upstream body so Vercel's proxy doesn't buffer until
  // the upstream closes. Combined with X-Accel-Buffering: no this gives us
  // real-time SSE delivery.
  const reader = upstreamRes.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}

/**
 * Debug-only SSE endpoint. NOT auth-gated. Streams 5 events 1 second apart
 * to verify Vercel actually streams responses (vs. buffers until close).
 *
 * If you see "tick 1" → "tick 5" arrive one per second, the proxy chain
 * is fine and the chat-full stall is upstream (sidecar / cloudflared) or
 * client-side. If everything arrives at once after 5s, Vercel is
 * buffering despite our headers.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 1; i <= 5; i++) {
        const data = JSON.stringify({ tick: i, ts: new Date().toISOString() });
        controller.enqueue(encoder.encode(`event: tick\ndata: ${data}\n\n`));
        await new Promise((r) => setTimeout(r, 1000));
      }
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
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

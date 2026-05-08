import { authUserOrDev } from "@/lib/dev-auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SIDECAR_INTERNAL_URL = "http://127.0.0.1:7654";

function sidecarBaseUrl() {
  const internalUrl = process.env.SIDECAR_INTERNAL_URL?.trim();
  if (internalUrl) return internalUrl.replace(/\/+$/, "");

  const publicUrl = process.env.NEXT_PUBLIC_SIDECAR_URL?.trim();
  if (publicUrl?.startsWith("http://") || publicUrl?.startsWith("https://")) {
    return publicUrl.replace(/\/+$/, "");
  }

  return DEFAULT_SIDECAR_INTERNAL_URL;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!authUserOrDev(user)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return Response.json({ error: "Missing sidecar token" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${sidecarBaseUrl()}/chat`, {
      method: "POST",
      headers: {
        authorization,
        "content-type": request.headers.get("content-type") ?? "application/json",
        accept: "text/event-stream",
      },
      body: await request.text(),
      cache: "no-store",
    });

    const headers = new Headers();
    headers.set(
      "content-type",
      upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
    );
    headers.set("cache-control", "no-cache, no-transform");
    headers.set("x-accel-buffering", "no");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach Claude Code sidecar";
    return Response.json({ error: message }, { status: 502 });
  }
}

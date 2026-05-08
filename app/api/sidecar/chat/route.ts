import { authUserOrDev } from "@/lib/dev-auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SIDECAR_INTERNAL_URL = "http://127.0.0.1:7654";
const DEFAULT_PRODUCTION_SIDECAR_URL = "https://chat.superkaiba.com";

function absoluteUrl(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed?.startsWith("http://") || trimmed?.startsWith("https://")
    ? trimmed.replace(/\/+$/, "")
    : null;
}

function sidecarBaseUrl() {
  const internalUrl = absoluteUrl(process.env.SIDECAR_INTERNAL_URL);
  if (internalUrl) return internalUrl;

  const sidecarUrl = absoluteUrl(process.env.SIDECAR_URL);
  if (sidecarUrl) return sidecarUrl;

  const publicUrl = absoluteUrl(process.env.NEXT_PUBLIC_SIDECAR_URL);
  if (publicUrl) return publicUrl;

  return process.env.NODE_ENV === "development"
    ? DEFAULT_SIDECAR_INTERNAL_URL
    : DEFAULT_PRODUCTION_SIDECAR_URL;
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

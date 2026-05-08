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

  const secret = process.env.SIDECAR_SHARED_SECRET;
  if (!secret) {
    return Response.json({ error: "Sidecar not configured" }, { status: 503 });
  }

  const body = await request.text();
  const upstream = await fetch(`${sidecarBaseUrl()}/end-session`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

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

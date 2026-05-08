import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

const LOGIN_USERNAME = process.env.DASHBOARD_LOGIN_USERNAME ?? "superkaiba";
const LOGIN_PASSWORD = process.env.DASHBOARD_LOGIN_PASSWORD ?? "superkaiba";
const LOGIN_EMAIL = process.env.DASHBOARD_LOGIN_EMAIL ?? "superkaiba@dashboard.local";

type AdminUser = {
  id: string;
  email?: string | null;
};

function adminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

async function adminFetch(path: string, init?: RequestInit) {
  const env = adminEnv();
  if (!env) return null;
  const response = await fetch(`${env.url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: env.key,
      authorization: `Bearer ${env.key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }
  return response;
}

async function ensurePasswordUser(password: string) {
  const listResponse = await adminFetch("/admin/users?page=1&per_page=1000");
  if (!listResponse) return;

  const data = (await listResponse.json()) as { users?: AdminUser[] };
  const existing = data.users?.find((user) => user.email === LOGIN_EMAIL);
  if (existing) {
    await adminFetch(`/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password,
        user_metadata: { username: LOGIN_USERNAME },
      }),
    });
    return;
  }

  await adminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: LOGIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { username: LOGIN_USERNAME },
    }),
  });
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  if (username !== LOGIN_USERNAME || password !== LOGIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  try {
    await ensurePasswordUser(password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to prepare dashboard login user";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: LOGIN_EMAIL,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

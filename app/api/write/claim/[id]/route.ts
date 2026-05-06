import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { claims } from "@/db/schema";

export const runtime = "nodejs";

type Patch = { title?: string; body?: string };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const patch = (await req.json()) as Patch;
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof patch.title === "string") {
    const t = patch.title.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    if (t.length > 500) return NextResponse.json({ error: "title too long" }, { status: 400 });
    update.title = t;
  }
  if (typeof patch.body === "string") {
    update.bodyJson = { kind: "markdown", text: patch.body };
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db.update(claims).set(update).where(eq(claims.id, id)).returning({
    id: claims.id,
    title: claims.title,
    updatedAt: claims.updatedAt,
  });
  if (!row) return NextResponse.json({ error: "claim not found" }, { status: 404 });

  return NextResponse.json({ ok: true, claim: row });
}

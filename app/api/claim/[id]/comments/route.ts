import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { comments } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();
  const rows = await db
    .select({
      id: comments.id,
      author: comments.author,
      authorKind: comments.authorKind,
      authorUserId: comments.authorUserId,
      authorEmail: comments.authorEmail,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(and(eq(comments.entityKind, "claim"), eq(comments.entityId, id)))
    .orderBy(asc(comments.createdAt));
  return NextResponse.json({ comments: rows });
}

const Body = z.object({
  body: z.string().min(1).max(8000),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const db = getDb();
  const author = user.email ?? user.id;
  const [row] = await db
    .insert(comments)
    .values({
      entityKind: "claim",
      entityId: id,
      authorKind: "user",
      author,
      authorUserId: user.id,
      authorEmail: user.email ?? null,
      body: parsed.data.body,
    })
    .returning();
  return NextResponse.json({ comment: row });
}

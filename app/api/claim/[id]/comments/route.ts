import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { comments } from "@/db/schema";
import { formatCommentBody, parseCommentBody } from "@/lib/comment-format";

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
  anchorText: z.string().trim().max(2000).optional(),
  parentCommentId: z.string().trim().max(80).optional(),
});

const DeleteBody = z.object({
  commentId: z.string().uuid(),
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
      body: formatCommentBody({
        body: parsed.data.body,
        anchorText: parsed.data.anchorText,
        parentCommentId: parsed.data.parentCommentId,
      }),
    })
    .returning();
  return NextResponse.json({ comment: row });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({ id: comments.id, body: comments.body })
    .from(comments)
    .where(and(eq(comments.entityKind, "claim"), eq(comments.entityId, id)));
  const ids = commentIdsToDelete(rows, parsed.data.commentId);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  await db.delete(comments).where(inArray(comments.id, ids));
  return NextResponse.json({ deletedIds: ids });
}

function commentIdsToDelete(
  rows: Array<{ id: string; body: string }>,
  rootId: string,
) {
  const children = new Map<string, string[]>();
  const ids = new Set(rows.map((row) => row.id));
  if (!ids.has(rootId)) return [];

  for (const row of rows) {
    const parent = parseCommentBody(row.body).parentCommentId;
    if (!parent) continue;
    const existing = children.get(parent) ?? [];
    existing.push(row.id);
    children.set(parent, existing);
  }

  const deleting: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || deleting.includes(id)) continue;
    deleting.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return deleting;
}

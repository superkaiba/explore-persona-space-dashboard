import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { chatSessions, chatMessages } from "@/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userOrUnauth() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();

  // Public-read on conversations: anyone can see them, but only auth can post.
  // List sessions for this claim with computed last message info.
  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdByUserId: chatSessions.createdByUserId,
      lastUserId: chatSessions.lastUserId,
      lastMessageAt: chatSessions.lastMessageAt,
      createdAt: chatSessions.createdAt,
      messageCount: sql<number>`(SELECT count(*)::int FROM chat_message WHERE session_id = ${chatSessions.id})`,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.scopeEntityKind, "claim"),
        eq(chatSessions.scopeEntityId, id),
      ),
    )
    .orderBy(desc(chatSessions.lastMessageAt), desc(chatSessions.createdAt));

  return NextResponse.json({ sessions });
}

const CreateBody = z.object({
  title: z.string().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await userOrUnauth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = CreateBody.parse(await req.json().catch(() => ({})));
  const db = getDb();
  const [row] = await db
    .insert(chatSessions)
    .values({
      scopeEntityKind: "claim",
      scopeEntityId: id,
      title: body.title ?? null,
      createdByUserId: user.id,
    })
    .returning();
  // Eagerly insert no messages; first user message creates the seed turn.
  return NextResponse.json({ session: row });
}

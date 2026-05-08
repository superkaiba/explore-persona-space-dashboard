import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { chatSessions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { authUserOrDev } from "@/lib/dev-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userOrUnauth() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return authUserOrDev(user);
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
      agentHandle: chatSessions.agentHandle,
      createdByUserId: chatSessions.createdByUserId,
      createdByUserEmail: chatSessions.createdByUserEmail,
      lastUserId: chatSessions.lastUserId,
      lastUserEmail: chatSessions.lastUserEmail,
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
  const sessionId = randomUUID();
  const db = getDb();
  const [row] = await db
    .insert(chatSessions)
    .values({
      id: sessionId,
      scopeEntityKind: "claim",
      scopeEntityId: id,
      agentHandle: `claim-${id.replace(/-/g, "").slice(0, 8)}-${sessionId
        .replace(/-/g, "")
        .slice(0, 12)}`,
      title: body.title ?? null,
      createdByUserId: user.id,
      createdByUserEmail: user.email ?? null,
    })
    .returning({
      id: chatSessions.id,
      title: chatSessions.title,
      agentHandle: chatSessions.agentHandle,
      createdByUserId: chatSessions.createdByUserId,
      createdByUserEmail: chatSessions.createdByUserEmail,
      lastUserId: chatSessions.lastUserId,
      lastUserEmail: chatSessions.lastUserEmail,
      lastMessageAt: chatSessions.lastMessageAt,
      createdAt: chatSessions.createdAt,
    });
  // Eagerly insert no messages; first user message creates the seed turn.
  return NextResponse.json({ session: { ...row, messageCount: 0 } });
}

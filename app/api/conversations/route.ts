import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { and, desc, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { chatSessions } from "@/db/schema";
import { authUserOrDev } from "@/lib/dev-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return authUserOrDev(user);
}

const CreateBody = z.object({
  title: z.string().max(200).optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
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
    .where(and(isNull(chatSessions.scopeEntityKind), isNull(chatSessions.scopeEntityId)))
    .orderBy(desc(chatSessions.lastMessageAt), desc(chatSessions.createdAt));

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = CreateBody.parse(await req.json().catch(() => ({})));
  const id = randomUUID();
  const db = getDb();
  const [session] = await db
    .insert(chatSessions)
    .values({
      id,
      title: body.title ?? null,
      agentHandle: `dashboard-${id.replace(/-/g, "").slice(0, 16)}`,
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

  return NextResponse.json({
    session: {
      ...session,
      messageCount: 0,
    },
  });
}

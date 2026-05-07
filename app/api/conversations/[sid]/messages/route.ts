import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { chatMessages, chatSessions } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sid: string }> },
) {
  const { sid } = await ctx.params;
  const db = getDb();
  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      body: chatMessages.body,
      toolCallJson: chatMessages.toolCallJson,
      userId: chatMessages.userId,
      userEmail: chatMessages.userEmail,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sid))
    .orderBy(asc(chatMessages.createdAt));
  return NextResponse.json({ messages });
}

const Append = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  body: z.string(),
  toolCallJson: z.unknown().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sid: string }> },
) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sid } = await ctx.params;
  const parsed = Append.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const m = parsed.data;
  const db = getDb();

  await db.insert(chatMessages).values({
    sessionId: sid,
    role: m.role,
    body: m.body,
    toolCallJson: m.toolCallJson as object | undefined,
    userId: m.role === "user" ? user.id : null,
    userEmail: m.role === "user" ? user.email ?? null : null,
  });

  // Bump session "last-spoken" metadata if this was a user message.
  if (m.role === "user") {
    await db
      .update(chatSessions)
      .set({
        lastUserId: user.id,
        lastUserEmail: user.email ?? null,
        lastMessageAt: new Date(),
      })
      .where(eq(chatSessions.id, sid));
  } else {
    await db
      .update(chatSessions)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatSessions.id, sid));
  }

  return NextResponse.json({ ok: true });
}

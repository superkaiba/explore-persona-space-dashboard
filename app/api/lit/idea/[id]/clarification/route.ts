import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  researchIdeaClarifications,
  researchIdeaEvents,
  researchIdeas,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  body: z.string().trim().min(1).max(20000),
  public: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = getDb();
  const [idea] = await db
    .select({ id: researchIdeas.id })
    .from(researchIdeas)
    .where(eq(researchIdeas.id, id))
    .limit(1);
  if (!idea) return NextResponse.json({ error: "idea not found" }, { status: 404 });

  const now = new Date();
  const [clarification] = await db
    .insert(researchIdeaClarifications)
    .values({
      ideaId: id,
      body: parsed.data.body,
      public: parsed.data.public,
      userId: user.id,
      userEmail: user.email ?? null,
      createdAt: now,
    })
    .returning();

  await db.insert(researchIdeaEvents).values({
    ideaId: id,
    eventType: "clarification",
    body: parsed.data.body,
    public: parsed.data.public,
    createdAt: now,
  });

  await db.update(researchIdeas).set({ updatedAt: now }).where(eq(researchIdeas.id, id));

  return NextResponse.json({ ok: true, clarification });
}

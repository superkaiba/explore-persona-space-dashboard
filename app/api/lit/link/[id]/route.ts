import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { litIdeaLinks, researchIdeaEvents } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { LIT_LINK_STATUSES } from "@/lib/lit";

export const runtime = "nodejs";

const Body = z.object({
  status: z.enum(LIT_LINK_STATUSES),
});

export async function PATCH(
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
  const now = new Date();
  const [link] = await db
    .update(litIdeaLinks)
    .set({ status: parsed.data.status, updatedAt: now })
    .where(eq(litIdeaLinks.id, id))
    .returning({
      id: litIdeaLinks.id,
      ideaId: litIdeaLinks.ideaId,
      status: litIdeaLinks.status,
    });

  if (!link) return NextResponse.json({ error: "link not found" }, { status: 404 });

  await db.insert(researchIdeaEvents).values({
    ideaId: link.ideaId,
    eventType: "link_review",
    body: `${user.email ?? "Authenticated user"} marked a literature link ${link.status}.`,
    public: false,
    createdAt: now,
  });

  return NextResponse.json({ ok: true, link });
}

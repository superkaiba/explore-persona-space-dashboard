import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { litItemStates, litItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { LIT_READ_STATUSES } from "@/lib/lit";

export const runtime = "nodejs";

const Body = z.object({
  itemId: z.string().uuid(),
  readStatus: z.enum(LIT_READ_STATUSES),
  notes: z.string().max(20000).optional().nullable(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select({ id: litItems.id })
    .from(litItems)
    .where(eq(litItems.id, parsed.data.itemId))
    .limit(1);
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  const now = new Date();
  const readAt = parsed.data.readStatus === "read" ? now : null;
  const [state] = await db
    .insert(litItemStates)
    .values({
      itemId: parsed.data.itemId,
      userId: user.id,
      userEmail: user.email ?? null,
      readStatus: parsed.data.readStatus,
      notes: parsed.data.notes ?? null,
      archived: parsed.data.archived ?? false,
      readAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [litItemStates.itemId, litItemStates.userId],
      set: {
        userEmail: user.email ?? null,
        readStatus: parsed.data.readStatus,
        notes: parsed.data.notes ?? null,
        archived: parsed.data.archived ?? false,
        readAt,
        updatedAt: now,
      },
    })
    .returning();

  return NextResponse.json({ ok: true, state });
}

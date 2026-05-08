import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { agentRunEvents, agentRuns } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { authUserOrDev } from "@/lib/dev-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return authUserOrDev(user);
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const now = new Date();
  const db = getDb();
  const [run] = await db
    .update(agentRuns)
    .set({
      status: "approved",
      updatedAt: now,
    })
    .where(eq(agentRuns.id, id))
    .returning();

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.insert(agentRunEvents).values({
    runId: id,
    eventType: "approved",
    body: `Approved by ${user.email ?? user.id}.`,
    metadataJson: { userId: user.id, userEmail: user.email ?? null },
  });

  return NextResponse.json({ run });
}

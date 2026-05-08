import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { edges, todos } from "@/db/schema";
import { ENTITY_KINDS } from "@/lib/entities";
import { TASK_INTENT_MODES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";

export const runtime = "nodejs";

const Kind = z.enum(ENTITY_KINDS);

const Patch = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  intentMode: z.enum(TASK_INTENT_MODES).optional(),
  intentSummary: z.string().trim().max(4000).optional().nullable(),
  usefulIf: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  ownerNote: z.string().trim().max(2000).optional().nullable(),
  linkedKind: Kind.optional().nullable(),
  linkedId: z.string().uuid().optional().nullable(),
  due: z.string().datetime().optional().nullable(),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.text !== undefined) update.text = patch.text;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.intentMode !== undefined) update.intentMode = patch.intentMode;
  if (patch.intentSummary !== undefined) update.intentSummary = patch.intentSummary || null;
  if (patch.usefulIf !== undefined) update.usefulIf = patch.usefulIf || null;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.ownerNote !== undefined) update.ownerNote = patch.ownerNote || null;
  if ("linkedKind" in patch || "linkedId" in patch) {
    if (!patch.linkedKind || !patch.linkedId) {
      update.linkedKind = null;
      update.linkedId = null;
    } else {
      update.linkedKind = patch.linkedKind;
      update.linkedId = patch.linkedId;
    }
  }
  if (patch.due !== undefined) update.due = patch.due ? new Date(patch.due) : null;

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const db = getDb();
  const [task] = await db.update(todos).set(update).where(eq(todos.id, id)).returning();
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  if ("linkedKind" in patch || "linkedId" in patch) {
    await db
      .delete(edges)
      .where(
        and(
          eq(edges.fromKind, "todo"),
          eq(edges.fromId, id),
          eq(edges.type, "derives_from"),
        ),
      );

    if (task.linkedKind && task.linkedId) {
      await db
        .insert(edges)
        .values({
          fromKind: "todo",
          fromId: id,
          toKind: task.linkedKind,
          toId: task.linkedId,
          type: "derives_from",
        })
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ task });
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { edges, todos } from "@/db/schema";
import { ENTITY_KINDS } from "@/lib/entities";
import { TASK_INTENT_MODES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";

export const runtime = "nodejs";

const Kind = z.enum(ENTITY_KINDS);

const Body = z.object({
  text: z.string().trim().min(1).max(500),
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

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const body = parsed.data;
  if ((body.linkedKind && !body.linkedId) || (!body.linkedKind && body.linkedId)) {
    return NextResponse.json(
      { error: "linkedKind and linkedId must be set together" },
      { status: 400 },
    );
  }

  const now = new Date();
  const db = getDb();
  const [task] = await db
    .insert(todos)
    .values({
      text: body.text,
      status: body.status ?? "inbox",
      kind: "proposed",
      intentMode: body.intentMode ?? "exploratory",
      intentSummary: body.intentSummary || null,
      usefulIf: body.usefulIf || null,
      priority: body.priority ?? "normal",
      ownerNote: body.ownerNote || null,
      linkedKind: body.linkedKind ?? null,
      linkedId: body.linkedId ?? null,
      due: body.due ? new Date(body.due) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (body.linkedKind && body.linkedId) {
    await db
      .insert(edges)
      .values({
        fromKind: "todo",
        fromId: task.id,
        toKind: body.linkedKind,
        toId: body.linkedId,
        type: "derives_from",
      })
      .onConflictDoNothing();
  }

  return NextResponse.json({ task });
}

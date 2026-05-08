import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/db/client";
import { edges } from "@/db/schema";
import { EDGE_TYPES, ENTITY_KINDS } from "@/lib/entities";

export const runtime = "nodejs";

const KIND = z.enum(ENTITY_KINDS);
const TYPE = z.enum(EDGE_TYPES);
const Body = z.object({
  fromKind: KIND,
  fromId: z.string().uuid(),
  toKind: KIND,
  toId: z.string().uuid(),
  type: TYPE,
});

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const e = parsed.data;
  if (e.fromKind === e.toKind && e.fromId === e.toId) {
    return NextResponse.json({ error: "self-loop" }, { status: 400 });
  }
  const db = getDb();
  await db
    .insert(edges)
    .values({ fromKind: e.fromKind, fromId: e.fromId, toKind: e.toKind, toId: e.toId, type: e.type })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const e = parsed.data;
  const db = getDb();
  await db
    .delete(edges)
    .where(
      and(
        eq(edges.fromKind, e.fromKind),
        eq(edges.fromId, e.fromId),
        eq(edges.toKind, e.toKind),
        eq(edges.toId, e.toId),
        eq(edges.type, e.type),
      ),
    );
  return NextResponse.json({ ok: true });
}

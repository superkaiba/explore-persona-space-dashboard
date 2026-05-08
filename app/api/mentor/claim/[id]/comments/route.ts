import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { comments } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  author: z.string().trim().max(80).optional(),
  body: z.string().trim().min(1).max(8000),
  anchorText: z.string().trim().max(2000).optional(),
  website: z.string().trim().max(0).optional(),
});

function formatBody(body: string, anchorText?: string) {
  const anchor = anchorText?.replace(/\s+/g, " ").trim();
  if (!anchor) return body;
  return [`Comment on:`, `> ${anchor}`, "", body].join("\n");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const author = parsed.data.author?.trim() || "Mentor";
  const db = getDb();
  const [row] = await db
    .insert(comments)
    .values({
      entityKind: "claim",
      entityId: id,
      authorKind: "mentor",
      author,
      authorEmail: null,
      body: formatBody(parsed.data.body, parsed.data.anchorText),
    })
    .returning();

  return NextResponse.json({ comment: row });
}

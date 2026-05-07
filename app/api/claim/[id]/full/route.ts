import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, figures } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();
  const [c] = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });

  let hero: { url: string; caption: string | null } | null = null;
  if (c.heroFigureId) {
    const [f] = await db
      .select({ url: figures.url, caption: figures.caption })
      .from(figures)
      .where(eq(figures.id, c.heroFigureId))
      .limit(1);
    if (f) hero = f;
  }
  const body = c.bodyJson as BodyJson;

  return NextResponse.json({
    id: c.id,
    title: c.title,
    confidence: c.confidence,
    githubIssueNumber: c.githubIssueNumber,
    body: body?.text ?? "",
    hero,
  });
}

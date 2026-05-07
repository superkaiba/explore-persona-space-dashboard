import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, experiments, todos } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve a GitHub issue number → dashboard entity (claim, experiment, or
 * todo). Used by IssueRef to turn "#237" mentions in markdown into
 * hoverable / clickable references.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ num: string }> },
) {
  const { num: numRaw } = await ctx.params;
  const num = parseInt(numRaw, 10);
  if (Number.isNaN(num)) {
    return NextResponse.json({ error: "bad number" }, { status: 400 });
  }
  const db = getDb();

  const [c] = await db
    .select({
      id: claims.id,
      title: claims.title,
      confidence: claims.confidence,
    })
    .from(claims)
    .where(eq(claims.githubIssueNumber, num))
    .limit(1);
  if (c) {
    return NextResponse.json({
      kind: "claim" as const,
      id: c.id,
      title: c.title,
      confidence: c.confidence,
      githubIssueNumber: num,
    });
  }

  const [e] = await db
    .select({ id: experiments.id, title: experiments.title, status: experiments.status })
    .from(experiments)
    .where(eq(experiments.githubIssueNumber, num))
    .limit(1);
  if (e) {
    return NextResponse.json({
      kind: "experiment" as const,
      id: e.id,
      title: e.title,
      status: e.status,
      githubIssueNumber: num,
    });
  }

  const [t] = await db
    .select({ id: todos.id, text: todos.text, kind: todos.kind })
    .from(todos)
    .where(eq(todos.githubIssueNumber, num))
    .limit(1);
  if (t) {
    return NextResponse.json({
      kind: t.kind === "untriaged" ? ("untriaged" as const) : ("proposed" as const),
      id: t.id,
      title: t.text,
      githubIssueNumber: num,
    });
  }

  return NextResponse.json({ error: "not in dashboard", githubIssueNumber: num }, { status: 404 });
}

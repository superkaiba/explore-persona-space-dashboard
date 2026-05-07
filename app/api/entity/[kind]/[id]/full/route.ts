import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, experiments, figures, todos } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

const ALLOWED = new Set(["claim", "experiment", "proposed", "untriaged"]);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await ctx.params;
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ error: "bad kind" }, { status: 400 });
  }
  const db = getDb();

  if (kind === "claim") {
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
      kind: "claim",
      title: c.title,
      body: body?.text ?? "",
      confidence: c.confidence,
      githubIssueNumber: c.githubIssueNumber,
      hero,
    });
  }

  if (kind === "experiment") {
    const [e] = await db.select().from(experiments).where(eq(experiments.id, id)).limit(1);
    if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });
    const plan = e.planJson as BodyJson;
    return NextResponse.json({
      id: e.id,
      kind: "experiment",
      title: e.title,
      body: plan?.text ?? e.hypothesis ?? "",
      status: e.status,
      githubIssueNumber: e.githubIssueNumber,
      hero: null,
    });
  }

  // proposed / untriaged → todo row
  const [t] = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: t.id,
    kind: t.kind === "untriaged" ? "untriaged" : "proposed",
    title: t.text,
    body: "",
    githubIssueNumber: t.githubIssueNumber,
    hero: null,
  });
}

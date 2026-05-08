import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  claims,
  experiments,
  figures,
  litItems,
  projects,
  researchIdeas,
  runs,
  todos,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_KINDS } from "@/lib/entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

const ALLOWED = new Set<string>(GRAPH_ENTITY_KINDS);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await ctx.params;
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ error: "bad kind" }, { status: 400 });
  }
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (kind === "project") {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project || (!project.public && !user)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: project.id,
      kind: "project",
      title: project.title,
      body: project.summary ?? "",
      status: project.status,
      slug: project.slug,
      githubIssueNumber: null,
      hero: null,
    });
  }

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

  if (kind === "run") {
    const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      id: run.id,
      kind: "run",
      title: run.wandbUrl ?? run.hfUrl ?? `Run ${run.seed ?? run.id.slice(0, 8)}`,
      body: [
        run.configYaml ? `## Config\n\n\`\`\`yaml\n${run.configYaml}\n\`\`\`` : "",
        run.metricsJson ? `## Metrics\n\n\`\`\`json\n${JSON.stringify(run.metricsJson, null, 2)}\n\`\`\`` : "",
      ].filter(Boolean).join("\n\n"),
      status: run.completedAt ? "completed" : run.startedAt ? "running" : "created",
      githubIssueNumber: null,
      hero: null,
    });
  }

  if (kind === "research_idea") {
    const [idea] = await db.select().from(researchIdeas).where(eq(researchIdeas.id, id)).limit(1);
    if (!idea || (!idea.public && !user)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: idea.id,
      kind: "research_idea",
      title: idea.title,
      body: [
        idea.shortSummary ? `## Summary\n\n${idea.shortSummary}` : "",
        idea.expandedSummary ? `## Expanded summary\n\n${idea.expandedSummary}` : "",
        idea.hypothesis ? `## Hypothesis\n\n${idea.hypothesis}` : "",
        idea.motivation ? `## Motivation\n\n${idea.motivation}` : "",
        idea.nextExperiments ? `## Next experiments\n\n${idea.nextExperiments}` : "",
      ].filter(Boolean).join("\n\n"),
      status: idea.status,
      slug: idea.slug,
      githubIssueNumber: null,
      hero: null,
    });
  }

  if (kind === "lit_item") {
    const [item] = await db.select().from(litItems).where(eq(litItems.id, id)).limit(1);
    if (!item || (!item.public && !user)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: item.id,
      kind: "lit_item",
      title: item.title,
      body: [
        item.summary ? `## Summary\n\n${item.summary}` : "",
        item.abstract ? `## Abstract\n\n${item.abstract}` : "",
        item.authorsJson?.length ? `## Authors\n\n${item.authorsJson.join(", ")}` : "",
      ].filter(Boolean).join("\n\n"),
      status: item.type,
      url: item.url,
      githubIssueNumber: null,
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
    body: [
      t.intentSummary ? `## Why this is worth doing\n\n${t.intentSummary}` : "",
      t.usefulIf ? `## Useful if\n\n${t.usefulIf}` : "",
      t.ownerNote ? `## Owner note\n\n${t.ownerNote}` : "",
    ].filter(Boolean).join("\n\n"),
    status: t.status,
    githubIssueNumber: t.githubIssueNumber,
    hero: null,
  });
}

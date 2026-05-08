import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  claims,
  edges,
  experiments,
  litIdeaLinks,
  litItems,
  projects,
  researchIdeas,
  runs,
  todos,
} from "@/db/schema";
import ClaimGraph, { type GraphEntity, type GraphEdge } from "@/components/graph/ClaimGraph";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

export default async function GraphPage() {
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    projectRows,
    claimRows,
    expRows,
    runRows,
    todoRows,
    ideaRows,
    litRows,
    litLinkRows,
    edgeRows,
  ] = await Promise.all([
    db
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        status: projects.status,
        summary: projects.summary,
        public: projects.public,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(user ? undefined : eq(projects.public, true))
      .orderBy(desc(projects.updatedAt))
      .limit(80),
    db
      .select({
        id: claims.id,
        title: claims.title,
        confidence: claims.confidence,
        githubIssueNumber: claims.githubIssueNumber,
        bodyJson: claims.bodyJson,
      })
      .from(claims)
      .orderBy(desc(claims.updatedAt)),
    db
      .select({
        id: experiments.id,
        title: experiments.title,
        status: experiments.status,
        githubIssueNumber: experiments.githubIssueNumber,
        planJson: experiments.planJson,
      })
      .from(experiments)
      .orderBy(desc(experiments.updatedAt)),
    db
      .select({
        id: runs.id,
        experimentId: runs.experimentId,
        seed: runs.seed,
        wandbUrl: runs.wandbUrl,
        hfUrl: runs.hfUrl,
        metricsJson: runs.metricsJson,
        startedAt: runs.startedAt,
        completedAt: runs.completedAt,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(80),
    db
      .select({
        id: todos.id,
        text: todos.text,
        status: todos.status,
        kind: todos.kind,
        intentSummary: todos.intentSummary,
        usefulIf: todos.usefulIf,
        ownerNote: todos.ownerNote,
        githubIssueNumber: todos.githubIssueNumber,
      })
      .from(todos)
      .where(eq(todos.kind, "proposed")),
    db
      .select({
        id: researchIdeas.id,
        slug: researchIdeas.slug,
        title: researchIdeas.title,
        status: researchIdeas.status,
        shortSummary: researchIdeas.shortSummary,
        expandedSummary: researchIdeas.expandedSummary,
        hypothesis: researchIdeas.hypothesis,
        public: researchIdeas.public,
        updatedAt: researchIdeas.updatedAt,
      })
      .from(researchIdeas)
      .where(user ? undefined : eq(researchIdeas.public, true))
      .orderBy(desc(researchIdeas.updatedAt))
      .limit(120),
    db
      .select({
        id: litItems.id,
        title: litItems.title,
        type: litItems.type,
        summary: litItems.summary,
        abstract: litItems.abstract,
        public: litItems.public,
        discoveredAt: litItems.discoveredAt,
        publishedAt: litItems.publishedAt,
      })
      .from(litItems)
      .where(user ? undefined : eq(litItems.public, true))
      .orderBy(desc(litItems.discoveredAt))
      .limit(160),
    db
      .select({
        ideaId: litIdeaLinks.ideaId,
        itemId: litIdeaLinks.itemId,
        relationType: litIdeaLinks.relationType,
        status: litIdeaLinks.status,
      })
      .from(litIdeaLinks)
      .where(user ? undefined : eq(litIdeaLinks.status, "accepted")),
    db
      .select({
        fromKind: edges.fromKind,
        fromId: edges.fromId,
        toKind: edges.toKind,
        toId: edges.toId,
        type: edges.type,
      })
      .from(edges),
  ]);

  const entities: GraphEntity[] = [
    ...projectRows.map((project): GraphEntity => ({
      id: project.id,
      kind: "project",
      title: project.title,
      confidence: null,
      status: project.status,
      githubIssueNumber: null,
      body: project.summary ?? "",
      slug: project.slug,
    })),
    ...claimRows.map((c): GraphEntity => {
      const body = c.bodyJson as BodyJson;
      return {
        id: c.id,
        kind: "claim",
        title: c.title,
        confidence: c.confidence,
        status: null,
        githubIssueNumber: c.githubIssueNumber,
        body: body?.text ?? "",
      };
    }),
    ...expRows.map((e): GraphEntity => {
      const plan = e.planJson as BodyJson;
      return {
        id: e.id,
        kind: "experiment",
        title: e.title,
        confidence: null,
        status: e.status,
        githubIssueNumber: e.githubIssueNumber,
        body: plan?.text ?? "",
      };
    }),
    ...runRows.map((r): GraphEntity => ({
      id: r.id,
      kind: "run",
      title: r.wandbUrl ?? r.hfUrl ?? `Run ${r.seed ?? r.id.slice(0, 8)}`,
      confidence: null,
      status: r.completedAt ? "completed" : r.startedAt ? "running" : "created",
      githubIssueNumber: null,
      body: [
        r.metricsJson ? JSON.stringify(r.metricsJson) : null,
        r.wandbUrl,
        r.hfUrl,
      ].filter(Boolean).join("\n\n"),
    })),
    ...todoRows.map((t): GraphEntity => {
      const body = [
        t.intentSummary,
        t.usefulIf ? `Useful if: ${t.usefulIf}` : null,
        t.ownerNote ? `Note: ${t.ownerNote}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        id: t.id,
        kind: "proposed",
        title: t.text,
        confidence: null,
        status: t.status,
        githubIssueNumber: t.githubIssueNumber,
        body,
      };
    }),
    ...ideaRows.map((idea): GraphEntity => ({
      id: idea.id,
      kind: "research_idea",
      title: idea.title,
      confidence: null,
      status: idea.status,
      githubIssueNumber: null,
      body: [idea.shortSummary, idea.expandedSummary, idea.hypothesis].filter(Boolean).join("\n\n"),
      slug: idea.slug,
    })),
    ...litRows.map((item): GraphEntity => ({
      id: item.id,
      kind: "lit_item",
      title: item.title,
      confidence: null,
      status: item.type,
      githubIssueNumber: null,
      body: [item.summary, item.abstract].filter(Boolean).join("\n\n"),
    })),
  ];

  const validIds = new Set(entities.map((e) => e.id));
  const graphEdges: GraphEdge[] = [
    ...edgeRows,
    ...runRows.map((run) => ({
      fromKind: "run",
      fromId: run.id,
      toKind: "experiment",
      toId: run.experimentId,
      type: "produces_evidence_for",
    })),
    ...litLinkRows.map((link) => ({
      fromKind: "research_idea",
      fromId: link.ideaId,
      toKind: "lit_item",
      toId: link.itemId,
      type: link.relationType,
    })),
  ];
  const seenEdges = new Set<string>();
  const filteredEdges: GraphEdge[] = graphEdges.filter((e) => {
    if (!validIds.has(e.fromId) || !validIds.has(e.toId)) return false;
    const key = `${e.fromKind}:${e.fromId}:${e.toKind}:${e.toId}:${e.type}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  });

  return (
    <div className="h-full w-full">
      <ClaimGraph entities={entities} edges={filteredEdges} />
    </div>
  );
}

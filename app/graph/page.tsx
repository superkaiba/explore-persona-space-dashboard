import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, experiments, todos, edges } from "@/db/schema";
import ClaimGraph, { type GraphEntity, type GraphEdge } from "@/components/graph/ClaimGraph";

export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

export default async function GraphPage() {
  const db = getDb();

  const [claimRows, expRows, todoRows, edgeRows] = await Promise.all([
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
        id: todos.id,
        text: todos.text,
        kind: todos.kind,
        githubIssueNumber: todos.githubIssueNumber,
      })
      .from(todos),
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
    ...todoRows.map((t): GraphEntity => ({
      id: t.id,
      kind: t.kind === "untriaged" ? "untriaged" : "proposed",
      title: t.text,
      confidence: null,
      status: null,
      githubIssueNumber: t.githubIssueNumber,
      body: "",
    })),
  ];

  const validIds = new Set(entities.map((e) => e.id));
  const filteredEdges: GraphEdge[] = edgeRows.filter(
    (e) => validIds.has(e.fromId) && validIds.has(e.toId),
  );

  return (
    <div className="h-screen w-full">
      <ClaimGraph entities={entities} edges={filteredEdges} />
    </div>
  );
}

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, edges } from "@/db/schema";
import ClaimGraph from "@/components/graph/ClaimGraph";

export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

export default async function GraphPage() {
  const db = getDb();

  const claimRows = await db
    .select({
      id: claims.id,
      title: claims.title,
      confidence: claims.confidence,
      githubIssueNumber: claims.githubIssueNumber,
      bodyJson: claims.bodyJson,
    })
    .from(claims)
    .orderBy(desc(claims.updatedAt));

  const edgeRows = await db
    .select({ fromId: edges.fromId, toId: edges.toId, type: edges.type })
    .from(edges)
    .where(eq(edges.fromKind, "claim"));

  const claimIds = new Set(claimRows.map((c) => c.id));
  const filteredEdges = edgeRows.filter(
    (e) => claimIds.has(e.fromId) && claimIds.has(e.toId),
  );

  const claimsForGraph = claimRows.map((c) => {
    const body = c.bodyJson as BodyJson;
    return {
      id: c.id,
      title: c.title,
      confidence: c.confidence,
      githubIssueNumber: c.githubIssueNumber,
      body: body?.text ?? "",
    };
  });

  return (
    <div className="h-screen w-full">
      <ClaimGraph claims={claimsForGraph} edges={filteredEdges} />
    </div>
  );
}

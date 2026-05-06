import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, edges, experiments, todos } from "@/db/schema";

/** Tool spec passed to Claude. */
export const TOOLS = [
  {
    name: "list_claims",
    description:
      "List claims (= clean-result findings) with title and confidence. Use to discover claims when the user's question is broad. Optionally filter by confidence (HIGH | MODERATE | LOW). Returns up to 50 most recently updated.",
    input_schema: {
      type: "object" as const,
      properties: {
        confidence: { type: "string", enum: ["HIGH", "MODERATE", "LOW"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_claims",
    description:
      "Full-text-ish search of claim titles and bodies for a keyword. Returns matching claims with id, title, confidence. Use this to find claims about a specific topic.",
    input_schema: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Free-text query, e.g. 'EM persona collapse'." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_claim",
    description:
      "Fetch the full body (markdown) of a claim by id or by GitHub issue number. Returns title, confidence, body, and linked entities.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        github_issue_number: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_in_progress",
    description:
      "List currently in-progress experiments (running, interpreting, reviewing, etc.). Use when the user asks 'what's running' or 'what's in progress'.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "list_open_work",
    description:
      "List open todos: proposed experiments and untriaged issues. Use when the user asks 'what's next' or 'what should I work on'.",
    input_schema: {
      type: "object" as const,
      properties: { kind: { type: "string", enum: ["proposed", "untriaged"] } },
      additionalProperties: false,
    },
  },
] as const;

export type ToolInput = Record<string, unknown>;

/** Run a single tool call. */
export async function runTool(name: string, input: ToolInput): Promise<unknown> {
  const db = getDb();
  switch (name) {
    case "list_claims": {
      const conf = input.confidence as "HIGH" | "MODERATE" | "LOW" | undefined;
      const rows = await db
        .select({
          id: claims.id,
          title: claims.title,
          confidence: claims.confidence,
          githubIssueNumber: claims.githubIssueNumber,
        })
        .from(claims)
        .where(conf ? eq(claims.confidence, conf) : undefined)
        .orderBy(desc(claims.updatedAt))
        .limit(50);
      return { count: rows.length, claims: rows };
    }
    case "search_claims": {
      const q = (input.query as string) ?? "";
      if (!q.trim()) return { count: 0, claims: [], error: "empty query" };
      const pattern = `%${q.trim()}%`;
      const rows = await db
        .select({
          id: claims.id,
          title: claims.title,
          confidence: claims.confidence,
          githubIssueNumber: claims.githubIssueNumber,
        })
        .from(claims)
        .where(or(ilike(claims.title, pattern), ilike(claims.bodyJson as never, pattern)))
        .limit(20);
      return { count: rows.length, query: q, claims: rows };
    }
    case "get_claim": {
      const id = input.id as string | undefined;
      const num = input.github_issue_number as number | undefined;
      const where = id
        ? eq(claims.id, id)
        : num != null
          ? eq(claims.githubIssueNumber, num)
          : undefined;
      if (!where) return { error: "must provide id or github_issue_number" };
      const [row] = await db
        .select({
          id: claims.id,
          title: claims.title,
          confidence: claims.confidence,
          githubIssueNumber: claims.githubIssueNumber,
          bodyJson: claims.bodyJson,
        })
        .from(claims)
        .where(where)
        .limit(1);
      if (!row) return { error: "claim not found" };

      // Linked entities
      const incoming = await db
        .select()
        .from(edges)
        .where(and(eq(edges.toKind, "claim"), eq(edges.toId, row.id)));
      const outgoing = await db
        .select()
        .from(edges)
        .where(and(eq(edges.fromKind, "claim"), eq(edges.fromId, row.id)));

      const claimIds = new Set<string>();
      for (const e of incoming) if (e.fromKind === "claim") claimIds.add(e.fromId);
      for (const e of outgoing) if (e.toKind === "claim") claimIds.add(e.toId);
      const linked = claimIds.size
        ? await db
            .select({
              id: claims.id,
              title: claims.title,
              confidence: claims.confidence,
              githubIssueNumber: claims.githubIssueNumber,
            })
            .from(claims)
            .where(inArray(claims.id, [...claimIds]))
        : [];

      const body = row.bodyJson as { kind: "markdown"; text: string } | null;
      return {
        id: row.id,
        title: row.title,
        confidence: row.confidence,
        github_issue_number: row.githubIssueNumber,
        body: body?.text ?? "",
        derives_from_claims: outgoing
          .filter((e) => e.toKind === "claim" && e.type === "derives_from")
          .map((e) => linked.find((c) => c.id === e.toId))
          .filter(Boolean),
        derived_by_claims: incoming
          .filter((e) => e.fromKind === "claim" && e.type === "derives_from")
          .map((e) => linked.find((c) => c.id === e.fromId))
          .filter(Boolean),
      };
    }
    case "list_in_progress": {
      const rows = await db
        .select({
          id: experiments.id,
          title: experiments.title,
          status: experiments.status,
          githubIssueNumber: experiments.githubIssueNumber,
          claimId: experiments.claimId,
        })
        .from(experiments)
        .orderBy(desc(experiments.updatedAt))
        .limit(50);
      return { count: rows.length, experiments: rows };
    }
    case "list_open_work": {
      const kind = input.kind as "proposed" | "untriaged" | undefined;
      const rows = await db
        .select({
          id: todos.id,
          text: todos.text,
          kind: todos.kind,
          githubIssueNumber: todos.githubIssueNumber,
        })
        .from(todos)
        .where(kind ? eq(todos.kind, kind) : undefined)
        .orderBy(desc(todos.createdAt))
        .limit(80);
      return { count: rows.length, todos: rows };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

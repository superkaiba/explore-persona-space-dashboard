import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  claims,
  edges,
  experiments,
  litItems,
  projects,
  researchIdeas,
  runs,
  todos,
} from "@/db/schema";
import { ENTITY_KIND_LABEL, entityHref, type EntityKind } from "@/lib/entities";

export type RelatedEntity = {
  id: string;
  kind: EntityKind;
  title: string;
  href: string | null;
  detail: string | null;
  edgeType: string;
  direction: "incoming" | "outgoing";
};

export async function getRelatedEntities(
  kind: EntityKind,
  id: string,
  opts: { includePrivate?: boolean } = {},
): Promise<RelatedEntity[]> {
  const db = getDb();
  const [incoming, outgoing] = await Promise.all([
    db.select().from(edges).where(and(eq(edges.toKind, kind), eq(edges.toId, id))),
    db.select().from(edges).where(and(eq(edges.fromKind, kind), eq(edges.fromId, id))),
  ]);

  const idsByKind = new Map<EntityKind, Set<string>>();
  const collect = (entityKind: EntityKind, entityId: string) => {
    if (!idsByKind.has(entityKind)) idsByKind.set(entityKind, new Set());
    idsByKind.get(entityKind)?.add(entityId);
  };

  for (const edge of incoming) collect(edge.fromKind, edge.fromId);
  for (const edge of outgoing) collect(edge.toKind, edge.toId);

  const titles = new Map<string, { title: string; href: string | null; detail: string | null }>();
  const put = (
    entityKind: EntityKind,
    entityId: string,
    title: string,
    href: string | null,
    detail: string | null,
  ) => {
    titles.set(`${entityKind}:${entityId}`, { title, href, detail });
  };

  const projectIds = [...(idsByKind.get("project") ?? [])];
  const claimIds = [...(idsByKind.get("claim") ?? [])];
  const experimentIds = [...(idsByKind.get("experiment") ?? [])];
  const runIds = [...(idsByKind.get("run") ?? [])];
  const todoIds = [...(idsByKind.get("todo") ?? [])];
  const ideaIds = [...(idsByKind.get("research_idea") ?? [])];
  const litIds = [...(idsByKind.get("lit_item") ?? [])];

  await Promise.all([
    projectIds.length
      ? db
          .select({
            id: projects.id,
            slug: projects.slug,
            title: projects.title,
            status: projects.status,
            summary: projects.summary,
          })
          .from(projects)
          .where(
            opts.includePrivate
              ? inArray(projects.id, projectIds)
              : and(inArray(projects.id, projectIds), eq(projects.public, true)),
          )
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "project",
                row.id,
                row.title,
                entityHref("project", row.id, row.slug),
                [row.status, row.summary].filter(Boolean).join(" · "),
              ),
            ),
          )
      : Promise.resolve(),
    claimIds.length
      ? db
          .select({
            id: claims.id,
            title: claims.title,
            confidence: claims.confidence,
            githubIssueNumber: claims.githubIssueNumber,
          })
          .from(claims)
          .where(inArray(claims.id, claimIds))
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "claim",
                row.id,
                row.title,
                entityHref("claim", row.id),
                [row.confidence, row.githubIssueNumber != null ? `#${row.githubIssueNumber}` : null]
                  .filter(Boolean)
                  .join(" · "),
              ),
            ),
          )
      : Promise.resolve(),
    experimentIds.length
      ? db
          .select({
            id: experiments.id,
            title: experiments.title,
            status: experiments.status,
            githubIssueNumber: experiments.githubIssueNumber,
          })
          .from(experiments)
          .where(inArray(experiments.id, experimentIds))
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "experiment",
                row.id,
                row.title,
                entityHref("experiment", row.id),
                [row.status, row.githubIssueNumber != null ? `#${row.githubIssueNumber}` : null]
                  .filter(Boolean)
                  .join(" · "),
              ),
            ),
          )
      : Promise.resolve(),
    runIds.length
      ? db
          .select({
            id: runs.id,
            seed: runs.seed,
            wandbUrl: runs.wandbUrl,
            hfUrl: runs.hfUrl,
            createdAt: runs.createdAt,
          })
          .from(runs)
          .where(inArray(runs.id, runIds))
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "run",
                row.id,
                row.wandbUrl ?? row.hfUrl ?? `Run ${row.seed ?? row.id.slice(0, 8)}`,
                entityHref("run", row.id),
                row.createdAt.toISOString().slice(0, 10),
              ),
            ),
          )
      : Promise.resolve(),
    todoIds.length
      ? db
          .select({
            id: todos.id,
            text: todos.text,
            status: todos.status,
            intentMode: todos.intentMode,
          })
          .from(todos)
          .where(inArray(todos.id, todoIds))
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "todo",
                row.id,
                row.text,
                entityHref("todo", row.id),
                [row.status, row.intentMode].filter(Boolean).join(" · "),
              ),
            ),
          )
      : Promise.resolve(),
    ideaIds.length
      ? db
          .select({
            id: researchIdeas.id,
            slug: researchIdeas.slug,
            title: researchIdeas.title,
            status: researchIdeas.status,
          })
          .from(researchIdeas)
          .where(
            opts.includePrivate
              ? inArray(researchIdeas.id, ideaIds)
              : and(inArray(researchIdeas.id, ideaIds), eq(researchIdeas.public, true)),
          )
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "research_idea",
                row.id,
                row.title,
                entityHref("research_idea", row.id, row.slug),
                row.status,
              ),
            ),
          )
      : Promise.resolve(),
    litIds.length
      ? db
          .select({
            id: litItems.id,
            title: litItems.title,
            type: litItems.type,
            source: litItems.source,
          })
          .from(litItems)
          .where(
            opts.includePrivate
              ? inArray(litItems.id, litIds)
              : and(inArray(litItems.id, litIds), eq(litItems.public, true)),
          )
          .then((rows) =>
            rows.forEach((row) =>
              put(
                "lit_item",
                row.id,
                row.title,
                entityHref("lit_item", row.id),
                [row.type, row.source].filter(Boolean).join(" · "),
              ),
            ),
          )
      : Promise.resolve(),
  ]);

  const related: RelatedEntity[] = [];
  for (const edge of outgoing) {
    const target = titles.get(`${edge.toKind}:${edge.toId}`);
    if (!target) continue;
    related.push({
      id: edge.toId,
      kind: edge.toKind,
      title: target.title,
      href: target.href,
      detail: target.detail || ENTITY_KIND_LABEL[edge.toKind],
      edgeType: edge.type,
      direction: "outgoing",
    });
  }
  for (const edge of incoming) {
    const source = titles.get(`${edge.fromKind}:${edge.fromId}`);
    if (!source) continue;
    related.push({
      id: edge.fromId,
      kind: edge.fromKind,
      title: source.title,
      href: source.href,
      detail: source.detail || ENTITY_KIND_LABEL[edge.fromKind],
      edgeType: edge.type,
      direction: "incoming",
    });
  }
  return related;
}

import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, experiments, litItems, projects, researchIdeas, runs, todos } from "@/db/schema";
import type { EntityOption } from "@/components/entity/EntitySelect";

export async function getEntityOptions(): Promise<EntityOption[]> {
  const db = getDb();
  const [projectRows, claimRows, experimentRows, runRows, taskRows, ideaRows, litRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        status: projects.status,
        summary: projects.summary,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(80),
    db
      .select({
        id: claims.id,
        title: claims.title,
        confidence: claims.confidence,
        githubIssueNumber: claims.githubIssueNumber,
      })
      .from(claims)
      .orderBy(desc(claims.updatedAt))
      .limit(100),
    db
      .select({
        id: experiments.id,
        title: experiments.title,
        status: experiments.status,
        githubIssueNumber: experiments.githubIssueNumber,
      })
      .from(experiments)
      .orderBy(desc(experiments.updatedAt))
      .limit(100),
    db
      .select({
        id: runs.id,
        seed: runs.seed,
        wandbUrl: runs.wandbUrl,
        hfUrl: runs.hfUrl,
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
        intentMode: todos.intentMode,
      })
      .from(todos)
      .orderBy(desc(todos.updatedAt))
      .limit(100),
    db
      .select({
        id: researchIdeas.id,
        title: researchIdeas.title,
        status: researchIdeas.status,
        shortSummary: researchIdeas.shortSummary,
      })
      .from(researchIdeas)
      .orderBy(desc(researchIdeas.updatedAt))
      .limit(120),
    db
      .select({
        id: litItems.id,
        title: litItems.title,
        type: litItems.type,
        source: litItems.source,
      })
      .from(litItems)
      .orderBy(desc(litItems.discoveredAt))
      .limit(160),
  ]);

  return [
    ...projectRows.map((project) => ({
      kind: "project" as const,
      id: project.id,
      label: project.title,
      detail: [project.status, project.summary].filter(Boolean).join(" · "),
    })),
    ...ideaRows.map((idea) => ({
      kind: "research_idea" as const,
      id: idea.id,
      label: idea.title,
      detail: [idea.status, idea.shortSummary].filter(Boolean).join(" · "),
    })),
    ...claimRows.map((claim) => ({
      kind: "claim" as const,
      id: claim.id,
      label: claim.title,
      detail: [
        claim.confidence,
        claim.githubIssueNumber != null ? `#${claim.githubIssueNumber}` : null,
      ].filter(Boolean).join(" · "),
    })),
    ...experimentRows.map((experiment) => ({
      kind: "experiment" as const,
      id: experiment.id,
      label: experiment.title,
      detail: [
        experiment.status,
        experiment.githubIssueNumber != null ? `#${experiment.githubIssueNumber}` : null,
      ].filter(Boolean).join(" · "),
    })),
    ...runRows.map((run) => ({
      kind: "run" as const,
      id: run.id,
      label: run.wandbUrl ?? run.hfUrl ?? `Run ${run.seed ?? run.id.slice(0, 8)}`,
      detail: run.createdAt.toISOString().slice(0, 10),
    })),
    ...taskRows.map((task) => ({
      kind: "todo" as const,
      id: task.id,
      label: task.text,
      detail: [task.status, task.intentMode].filter(Boolean).join(" · "),
    })),
    ...litRows.map((item) => ({
      kind: "lit_item" as const,
      id: item.id,
      label: item.title,
      detail: [item.type, item.source].filter(Boolean).join(" · "),
    })),
  ];
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { claims, experiments, litItems, projects, researchIdeas, runs, todos } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { EntityComments } from "@/components/discussion/EntityComments";
import { EntityLinkManager } from "@/components/entity/EntityLinkManager";
import { RelatedEntitiesList } from "@/components/entity/RelatedEntitiesList";
import { TaskEditForm } from "@/components/tasks/TaskEditForm";
import { getEntityOptions } from "@/lib/entity-options";
import { getRelatedEntities } from "@/lib/related-entities";
import {
  TASK_INTENT_LABEL,
  TASK_INTENT_MODES,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITIES,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  type TaskIntentMode,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";

export const dynamic = "force-dynamic";

function asStatus(status: string): TaskStatus {
  if (status === "open") return "inbox";
  if (status === "in_progress") return "running";
  return TASK_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : "inbox";
}

function asIntent(mode: string | null): TaskIntentMode {
  return TASK_INTENT_MODES.includes(mode as TaskIntentMode)
    ? (mode as TaskIntentMode)
    : "exploratory";
}

function asPriority(priority: string | null): TaskPriority {
  return TASK_PRIORITIES.includes(priority as TaskPriority)
    ? (priority as TaskPriority)
    : "normal";
}

function fmtDate(d: Date | null): string {
  if (!d) return "No date";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [task] = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
  if (!task) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = !!user;

  const linkOptions = canEdit ? await getEntityOptions() : [];

  let linked: { href: string; label: string; kind: string } | null = null;
  if (task.linkedKind === "project" && task.linkedId) {
    const [project] = await db
      .select({ id: projects.id, slug: projects.slug, title: projects.title })
      .from(projects)
      .where(eq(projects.id, task.linkedId))
      .limit(1);
    if (project) {
      linked = {
        href: `/projects/${project.slug}`,
        kind: "Project",
        label: project.title,
      };
    }
  } else if (task.linkedKind === "claim" && task.linkedId) {
    const [c] = await db
      .select({ id: claims.id, title: claims.title, githubIssueNumber: claims.githubIssueNumber })
      .from(claims)
      .where(eq(claims.id, task.linkedId))
      .limit(1);
    if (c) {
      linked = {
        href: `/claim/${c.id}`,
        kind: "Claim",
        label: `${c.githubIssueNumber != null ? `#${c.githubIssueNumber} ` : ""}${c.title}`,
      };
    }
  } else if (task.linkedKind === "experiment" && task.linkedId) {
    const [e] = await db
      .select({
        id: experiments.id,
        title: experiments.title,
        githubIssueNumber: experiments.githubIssueNumber,
      })
      .from(experiments)
      .where(eq(experiments.id, task.linkedId))
      .limit(1);
    if (e) {
      linked = {
        href: `/experiment/${e.id}`,
        kind: "Experiment",
        label: `${e.githubIssueNumber != null ? `#${e.githubIssueNumber} ` : ""}${e.title}`,
      };
    }
  } else if (task.linkedKind === "run" && task.linkedId) {
    const [r] = await db.select().from(runs).where(eq(runs.id, task.linkedId)).limit(1);
    if (r) {
      linked = {
        href: `/run/${r.id}`,
        kind: "Run",
        label: r.wandbUrl ?? r.hfUrl ?? `Run ${r.seed ?? r.id.slice(0, 8)}`,
      };
    }
  } else if (task.linkedKind === "research_idea" && task.linkedId) {
    const [idea] = await db
      .select({ id: researchIdeas.id, slug: researchIdeas.slug, title: researchIdeas.title })
      .from(researchIdeas)
      .where(eq(researchIdeas.id, task.linkedId))
      .limit(1);
    if (idea) {
      linked = {
        href: `/lit/ideas/${idea.slug}`,
        kind: "Research idea",
        label: idea.title,
      };
    }
  } else if (task.linkedKind === "lit_item" && task.linkedId) {
    const [item] = await db
      .select({ id: litItems.id, title: litItems.title })
      .from(litItems)
      .where(eq(litItems.id, task.linkedId))
      .limit(1);
    if (item) {
      linked = {
        href: `/lit/items/${item.id}`,
        kind: "Literature",
        label: item.title,
      };
    }
  } else if (task.linkedKind === "todo" && task.linkedId) {
    const [todo] = await db
      .select({ id: todos.id, text: todos.text })
      .from(todos)
      .where(eq(todos.id, task.linkedId))
      .limit(1);
    if (todo) {
      linked = {
        href: `/task/${todo.id}`,
        kind: "Task",
        label: todo.text,
      };
    }
  }

  const status = asStatus(task.status);
  const intentMode = asIntent(task.intentMode);
  const priority = asPriority(task.priority);
  const related = await getRelatedEntities("todo", task.id, { includePrivate: canEdit });

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_360px] gap-8 px-8 py-8">
        <div className="min-w-0">
          <Link
            href="/todos"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3 w-3" />
            tasks
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-proposed" />
            <span>Research task</span>
            <span className="rounded bg-subtle px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-fg">
              {TASK_STATUS_LABEL[status]}
            </span>
            <span className="rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-running">
              {TASK_INTENT_LABEL[intentMode]}
            </span>
            <span className="rounded bg-subtle px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-fg">
              {TASK_PRIORITY_LABEL[priority]}
            </span>
            {task.githubIssueNumber != null && (
              <a
                href={`https://github.com/superkaiba/explore-persona-space/issues/${task.githubIssueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                #{task.githubIssueNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight">
            {task.text}
          </h1>

          <div className="mt-8 grid gap-5">
            <InfoBlock
              title="Why this is worth doing"
              body={task.intentSummary || "Not recorded yet."}
            />
            <InfoBlock title="Useful if" body={task.usefulIf || "Not recorded yet."} />
            {linked ? (
              <section className="panel rounded-lg p-4">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Linked entity
                </h2>
                <Link href={linked.href} className="mt-2 block text-[13px] hover:underline">
                  <span className="font-medium">{linked.kind}: </span>
                  {linked.label}
                </Link>
              </section>
            ) : (
              <section className="rounded-lg border border-dashed border-border bg-subtle/40 p-4">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Linked entity
                </h2>
                <p className="mt-2 text-[13px] text-muted">
                  No parent claim or experiment is linked yet.
                </p>
              </section>
            )}
            {task.ownerNote && <InfoBlock title="Owner note" body={task.ownerNote} />}
          </div>

          <section className="mt-10 border-t border-border pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold tracking-tight">Workspace links</h2>
              {canEdit && (
                <EntityLinkManager
                  fromKind="todo"
                  fromId={task.id}
                  options={linkOptions}
                  compact
                />
              )}
            </div>
            <RelatedEntitiesList items={related} />
          </section>

          <section className="mt-10 border-t border-border pt-6">
            <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Comments</h2>
            <EntityComments entityKind="todo" entityId={task.id} canPost={canEdit} />
          </section>
        </div>

        <aside className="space-y-4">
          <TaskEditForm
            task={{
              id: task.id,
              text: task.text,
              status,
              intentMode,
              intentSummary: task.intentSummary,
              usefulIf: task.usefulIf,
              priority,
              ownerNote: task.ownerNote,
              linkedKind: task.linkedKind,
              linkedId: task.linkedId,
            }}
            canEdit={canEdit}
            linkOptions={linkOptions}
          />
          <div className="panel rounded-lg p-4 text-[12px]">
            <div className="flex items-center justify-between border-b border-border py-2">
              <span className="text-muted">Created</span>
              <span className="font-mono">{fmtDate(task.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted">Updated</span>
              <span className="font-mono">{fmtDate(task.updatedAt)}</span>
            </div>
          </div>
        </aside>
      </article>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="panel rounded-lg p-4">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{body}</p>
    </section>
  );
}

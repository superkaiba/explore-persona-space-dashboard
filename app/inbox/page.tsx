import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { BookOpen, FlaskConical, GitPullRequestArrow, Lightbulb, ListTodo } from "lucide-react";
import { getDb } from "@/db/client";
import {
  experiments,
  litIdeaLinks,
  litItemStates,
  litItems,
  researchIdeas,
  todos,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { formatLitDate, formatLitType } from "@/lib/lit";
import { displayTaskStatus } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8">
          <h1 className="text-xl font-semibold tracking-tight">Research inbox</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            The inbox is private because it includes raw ideas, notes, pending literature links,
            and untriaged work. Sign in to triage the current research queue.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const [itemRows, proposedLinks, unlinkedTasks, ideaRows, experimentRows] = await Promise.all([
    db
      .select({
        id: litItems.id,
        title: litItems.title,
        type: litItems.type,
        source: litItems.source,
        summary: litItems.summary,
        discoveredAt: litItems.discoveredAt,
        publishedAt: litItems.publishedAt,
        readStatus: litItemStates.readStatus,
        archived: litItemStates.archived,
      })
      .from(litItems)
      .leftJoin(
        litItemStates,
        and(eq(litItemStates.itemId, litItems.id), eq(litItemStates.userId, user.id)),
      )
      .orderBy(desc(sql`coalesce(${litItems.publishedAt}, ${litItems.discoveredAt})`))
      .limit(60),
    db
      .select({
        id: litIdeaLinks.id,
        relationType: litIdeaLinks.relationType,
        rationale: litIdeaLinks.rationale,
        ideaSlug: researchIdeas.slug,
        ideaTitle: researchIdeas.title,
        itemId: litItems.id,
        itemTitle: litItems.title,
        updatedAt: litIdeaLinks.updatedAt,
      })
      .from(litIdeaLinks)
      .innerJoin(researchIdeas, eq(researchIdeas.id, litIdeaLinks.ideaId))
      .innerJoin(litItems, eq(litItems.id, litIdeaLinks.itemId))
      .where(eq(litIdeaLinks.status, "proposed"))
      .orderBy(desc(litIdeaLinks.updatedAt))
      .limit(20),
    db
      .select({
        id: todos.id,
        text: todos.text,
        status: todos.status,
        priority: todos.priority,
        updatedAt: todos.updatedAt,
      })
      .from(todos)
      .where(and(isNull(todos.linkedKind), isNull(todos.linkedId)))
      .orderBy(desc(todos.updatedAt))
      .limit(20),
    db
      .select({
        id: researchIdeas.id,
        slug: researchIdeas.slug,
        title: researchIdeas.title,
        status: researchIdeas.status,
        shortSummary: researchIdeas.shortSummary,
        updatedAt: researchIdeas.updatedAt,
      })
      .from(researchIdeas)
      .orderBy(desc(researchIdeas.updatedAt))
      .limit(20),
    db
      .select({
        id: experiments.id,
        title: experiments.title,
        status: experiments.status,
        updatedAt: experiments.updatedAt,
      })
      .from(experiments)
      .orderBy(desc(experiments.updatedAt))
      .limit(20),
  ]);

  const unreadItems = itemRows
    .filter((item) => !item.archived && (item.readStatus ?? "unread") === "unread")
    .slice(0, 16);
  const activeExperiments = experimentRows.filter((experiment) =>
    [
      "planning",
      "plan_pending",
      "implementing",
      "running",
      "interpreting",
      "reviewing",
      "awaiting_promotion",
      "blocked",
    ].includes(experiment.status),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl p-8">
        <header className="mb-6 border-b border-border pb-5">
          <h1 className="text-xl font-semibold tracking-tight">Research inbox</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">
            Triage new literature, proposed links, unlinked work, and active experiment updates
            into durable entity pages.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Stat label="unread literature" value={unreadItems.length} />
            <Stat label="pending links" value={proposedLinks.length} />
            <Stat label="unlinked tasks" value={unlinkedTasks.length} />
            <Stat label="active experiments" value={activeExperiments.length} />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <section>
            <SectionTitle icon={BookOpen} title="Unread literature" href="/lit/items" />
            <div className="flex flex-col gap-2">
              {unreadItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/lit/items/${item.id}`}
                  className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/70"
                >
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                      {formatLitType(item.type)}
                    </span>
                    <span>{item.source ?? "workflow"}</span>
                    <span>{formatLitDate(item.publishedAt ?? item.discoveredAt)}</span>
                  </div>
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">
                    {item.title}
                  </div>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {item.summary}
                    </p>
                  )}
                </Link>
              ))}
              {unreadItems.length === 0 && <Empty>No unread literature in the queue.</Empty>}
            </div>
          </section>

          <section>
            <SectionTitle icon={GitPullRequestArrow} title="Pending literature links" href="/lit" />
            <div className="flex flex-col gap-2">
              {proposedLinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/lit/ideas/${link.ideaSlug}`}
                  className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/70"
                >
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                      {link.relationType}
                    </span>
                    <span>{formatLitDate(link.updatedAt)}</span>
                  </div>
                  <div className="line-clamp-1 text-[12px] font-medium">{link.ideaTitle}</div>
                  <div className="mt-1 line-clamp-2 text-[12px] text-muted">
                    {link.itemTitle}
                  </div>
                  {link.rationale && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                      {link.rationale}
                    </p>
                  )}
                </Link>
              ))}
              {proposedLinks.length === 0 && <Empty>No pending link reviews.</Empty>}
            </div>
          </section>

          <section>
            <SectionTitle icon={ListTodo} title="Unlinked tasks" href="/todos" />
            <div className="flex flex-col gap-2">
              {unlinkedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/task/${task.id}`}
                  className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/70"
                >
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                      {displayTaskStatus(task.status)}
                    </span>
                    <span>{task.priority}</span>
                    <span>{formatLitDate(task.updatedAt)}</span>
                  </div>
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">
                    {task.text}
                  </div>
                </Link>
              ))}
              {unlinkedTasks.length === 0 && <Empty>All tasks have a parent link.</Empty>}
            </div>
          </section>

          <section>
            <SectionTitle icon={Lightbulb} title="Recently changed ideas" href="/lit/ideas" />
            <div className="flex flex-col gap-2">
              {ideaRows.map((idea) => (
                <Link
                  key={idea.id}
                  href={`/lit/ideas/${idea.slug}`}
                  className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/70"
                >
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                      {idea.status}
                    </span>
                    <span>{formatLitDate(idea.updatedAt)}</span>
                  </div>
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">
                    {idea.title}
                  </div>
                  {idea.shortSummary && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {idea.shortSummary}
                    </p>
                  )}
                </Link>
              ))}
              {ideaRows.length === 0 && <Empty>No ideas yet.</Empty>}
            </div>
          </section>

          <section className="xl:col-span-2">
            <SectionTitle icon={FlaskConical} title="Active experiments" href="/live" />
            <div className="grid gap-2 lg:grid-cols-2">
              {activeExperiments.map((experiment) => (
                <Link
                  key={experiment.id}
                  href={`/experiment/${experiment.id}`}
                  className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/70"
                >
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                      {experiment.status.replace(/_/g, " ")}
                    </span>
                    <span>{formatLitDate(experiment.updatedAt)}</span>
                  </div>
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">
                    {experiment.title}
                  </div>
                </Link>
              ))}
              {activeExperiments.length === 0 && <Empty>No active experiment updates.</Empty>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border border-border bg-subtle px-2 py-1">
      <span className="font-mono text-fg">{value}</span>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  href,
}: {
  icon: typeof BookOpen;
  title: string;
  href: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted" />
      <h2 className="text-[12px] font-semibold tracking-tight">{title}</h2>
      <Link href={href} className="ml-auto text-[12px] text-muted hover:text-fg">
        View
      </Link>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[12px] text-muted">
      {children}
    </p>
  );
}

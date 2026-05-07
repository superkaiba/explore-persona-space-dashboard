import Link from "next/link";
import { desc, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { claims, experiments, todos } from "@/db/schema";
import { ActivityFeed, type FeedItem } from "@/components/timeline/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 3_600_000);

  const [claimRows, expRows, todoRows] = await Promise.all([
    db
      .select({
        id: claims.id,
        title: claims.title,
        confidence: claims.confidence,
        githubIssueNumber: claims.githubIssueNumber,
        createdAt: claims.createdAt,
        updatedAt: claims.updatedAt,
      })
      .from(claims)
      .where(gte(claims.updatedAt, since))
      .orderBy(desc(claims.updatedAt)),
    db
      .select({
        id: experiments.id,
        title: experiments.title,
        status: experiments.status,
        githubIssueNumber: experiments.githubIssueNumber,
        createdAt: experiments.createdAt,
        updatedAt: experiments.updatedAt,
      })
      .from(experiments)
      .where(gte(experiments.updatedAt, since))
      .orderBy(desc(experiments.updatedAt)),
    db
      .select({
        id: todos.id,
        text: todos.text,
        kind: todos.kind,
        githubIssueNumber: todos.githubIssueNumber,
        createdAt: todos.createdAt,
      })
      .from(todos)
      .where(gte(todos.createdAt, since))
      .orderBy(desc(todos.createdAt)),
  ]);

  const items: FeedItem[] = [
    ...claimRows.map((c): FeedItem => ({
      id: `claim-${c.id}`,
      kind: "claim",
      title: c.title,
      confidence: c.confidence,
      githubIssueNumber: c.githubIssueNumber,
      timestamp: c.updatedAt,
      detailHref: `/claim/${c.id}`,
      verb: c.createdAt.getTime() === c.updatedAt.getTime() ? "created" : "updated",
    })),
    ...expRows.map((e): FeedItem => ({
      id: `exp-${e.id}`,
      kind: "experiment",
      title: e.title,
      status: e.status,
      githubIssueNumber: e.githubIssueNumber,
      timestamp: e.updatedAt,
      verb: e.createdAt.getTime() === e.updatedAt.getTime() ? "started" : "advanced",
    })),
    ...todoRows.map((t): FeedItem => ({
      id: `todo-${t.id}`,
      kind: t.kind === "untriaged" ? "untriaged" : "proposed",
      title: t.text,
      githubIssueNumber: t.githubIssueNumber,
      timestamp: t.createdAt,
      verb: "filed",
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-8">
        <header className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Today</h1>
            <p className="mt-1 text-[12px] text-muted">Last 24 hours of activity</p>
          </div>
          <nav className="flex gap-1 text-[11px]">
            <Link href="/timeline/today" className="rounded-md bg-fg px-2 py-1 text-canvas">
              Today
            </Link>
            <Link
              href="/timeline/week"
              className="rounded-md px-2 py-1 text-muted hover:bg-subtle hover:text-fg"
            >
              Week
            </Link>
          </nav>
        </header>

        <ActivityFeed items={items} emptyText="No activity in the last 24 hours." />
      </div>
    </div>
  );
}

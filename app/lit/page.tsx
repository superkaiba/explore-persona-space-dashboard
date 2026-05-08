import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { BookOpen, Lightbulb, Rss } from "lucide-react";
import { getDb } from "@/db/client";
import { litDigestRuns, litItems, researchIdeas } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { formatLitDate, formatLitType } from "@/lib/lit";

export const dynamic = "force-dynamic";

export default async function LitReviewPage() {
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [itemCountRow] = await db
    .select({ value: count() })
    .from(litItems)
    .where(eq(litItems.public, true));
  const [ideaCountRow] = await db
    .select({ value: count() })
    .from(researchIdeas)
    .where(eq(researchIdeas.public, true));

  const recentItems = await db
    .select({
      id: litItems.id,
      title: litItems.title,
      type: litItems.type,
      source: litItems.source,
      publishedAt: litItems.publishedAt,
      discoveredAt: litItems.discoveredAt,
      summary: litItems.summary,
    })
    .from(litItems)
    .where(eq(litItems.public, true))
    .orderBy(desc(sql`coalesce(${litItems.publishedAt}, ${litItems.discoveredAt})`))
    .limit(10);

  const ideas = await db
    .select({
      id: researchIdeas.id,
      slug: researchIdeas.slug,
      title: researchIdeas.title,
      status: researchIdeas.status,
      shortSummary: researchIdeas.shortSummary,
      updatedAt: researchIdeas.updatedAt,
    })
    .from(researchIdeas)
    .where(eq(researchIdeas.public, true))
    .orderBy(desc(researchIdeas.updatedAt))
    .limit(8);

  const runs = await db
    .select({
      runDate: litDigestRuns.runDate,
      status: litDigestRuns.status,
      candidateCount: litDigestRuns.candidateCount,
      selectedCount: litDigestRuns.selectedCount,
    })
    .from(litDigestRuns)
    .orderBy(desc(litDigestRuns.runDate))
    .limit(5);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Literature review</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
              A durable reading queue and idea log fed by the VM literature workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Stat icon={BookOpen} label="items" value={itemCountRow?.value ?? 0} />
            <Stat icon={Lightbulb} label="ideas" value={ideaCountRow?.value ?? 0} />
            <Stat icon={Rss} label="signed in" value={user ? "yes" : "no"} />
          </div>
        </header>

        <div className="mb-5 flex flex-wrap gap-2 text-[12px]">
          <Link
            href="/lit/items"
            className="rounded-md border border-border bg-fg px-3 py-1.5 font-medium text-canvas"
          >
            Reading queue
          </Link>
          <Link
            href="/lit/ideas"
            className="rounded-md border border-border bg-panel px-3 py-1.5 font-medium text-fg hover:bg-subtle"
          >
            Research ideas
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[12px] font-semibold tracking-tight">Most recent</h2>
              <Link href="/lit/items" className="text-[12px] text-muted hover:text-fg">
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/lit/items/${item.id}`}
                  className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/60"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted">
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-fg">
                      {formatLitType(item.type)}
                    </span>
                    <span>{item.source ?? "workflow"}</span>
                    <span>{formatLitDate(item.publishedAt ?? item.discoveredAt)}</span>
                  </div>
                  <h3 className="line-clamp-2 text-[13px] font-medium leading-snug">
                    {item.title}
                  </h3>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {item.summary}
                    </p>
                  )}
                </Link>
              ))}
              {recentItems.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[13px] text-muted">
                  No literature has been synced yet.
                </p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[12px] font-semibold tracking-tight">Research ideas</h2>
                <Link href="/lit/ideas" className="text-[12px] text-muted hover:text-fg">
                  View all
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {ideas.map((idea) => (
                  <Link
                    key={idea.id}
                    href={`/lit/ideas/${idea.slug}`}
                    className="rounded-md border border-border bg-panel p-3 shadow-card hover:bg-subtle/60"
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted">
                      <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                        {idea.status}
                      </span>
                      <span>{formatLitDate(idea.updatedAt)}</span>
                    </div>
                    <h3 className="line-clamp-2 text-[13px] font-medium leading-snug">
                      {idea.title}
                    </h3>
                    {idea.shortSummary && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                        {idea.shortSummary}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[12px] font-semibold tracking-tight">Digest runs</h2>
              <div className="rounded-md border border-border bg-panel">
                {runs.map((run) => (
                  <div
                    key={run.runDate}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <span className="font-mono text-[11px] text-fg">{run.runDate}</span>
                    <span className="text-[11px] text-muted">
                      {run.selectedCount ?? 0}/{run.candidateCount ?? 0} selected
                    </span>
                  </div>
                ))}
                {runs.length === 0 && (
                  <p className="p-3 text-[12px] text-muted">No runs synced.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle px-2 py-1">
      <Icon className="h-3 w-3 text-muted" />
      <span className="font-mono text-fg">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

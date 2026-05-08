import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { researchIdeas } from "@/db/schema";
import { formatLitDate } from "@/lib/lit";

export const dynamic = "force-dynamic";

export default async function LitIdeasPage() {
  const db = getDb();
  const ideas = await db
    .select({
      id: researchIdeas.id,
      slug: researchIdeas.slug,
      title: researchIdeas.title,
      status: researchIdeas.status,
      shortSummary: researchIdeas.shortSummary,
      expandedSummary: researchIdeas.expandedSummary,
      updatedAt: researchIdeas.updatedAt,
    })
    .from(researchIdeas)
    .where(eq(researchIdeas.public, true))
    .orderBy(desc(researchIdeas.updatedAt))
    .limit(200);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-8">
        <header className="mb-5 border-b border-border pb-5">
          <Link href="/lit" className="text-[12px] text-muted hover:text-fg">
            Literature review
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Research ideas</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            A running idea log updated by literature ingestion and your own clarifications.
          </p>
        </header>

        <div className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <Link
              key={idea.id}
              href={`/lit/ideas/${idea.slug}`}
              className="rounded-md border border-border bg-panel p-4 shadow-card hover:bg-subtle/60"
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                  {idea.status}
                </span>
                <span>{formatLitDate(idea.updatedAt)}</span>
              </div>
              <h2 className="text-[14px] font-medium leading-snug">{idea.title}</h2>
              {(idea.shortSummary ?? idea.expandedSummary) && (
                <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted">
                  {idea.shortSummary ?? idea.expandedSummary}
                </p>
              )}
            </Link>
          ))}
          {ideas.length === 0 && (
            <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[13px] text-muted">
              No research ideas have been synced yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

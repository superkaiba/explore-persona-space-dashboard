import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  litIdeaLinks,
  litItems,
  researchIdeaClarifications,
  researchIdeaEvents,
  researchIdeas,
} from "@/db/schema";
import { ClarificationForm } from "@/components/lit/ClarificationForm";
import { LinkReviewControls } from "@/components/lit/LinkReviewControls";
import { EntityComments } from "@/components/discussion/EntityComments";
import { EntityLinkManager } from "@/components/entity/EntityLinkManager";
import { RelatedEntitiesList } from "@/components/entity/RelatedEntitiesList";
import { createClient } from "@/lib/supabase/server";
import { getEntityOptions } from "@/lib/entity-options";
import { formatLitDate, formatLitType } from "@/lib/lit";
import { getRelatedEntities } from "@/lib/related-entities";

export const dynamic = "force-dynamic";

export default async function LitIdeaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [idea] = await db
    .select()
    .from(researchIdeas)
    .where(user ? eq(researchIdeas.slug, slug) : and(eq(researchIdeas.slug, slug), eq(researchIdeas.public, true)))
    .limit(1);
  if (!idea) notFound();

  const links = await db
    .select({
      id: litIdeaLinks.id,
      relationType: litIdeaLinks.relationType,
      confidence: litIdeaLinks.confidence,
      rationale: litIdeaLinks.rationale,
      status: litIdeaLinks.status,
      itemId: litItems.id,
      itemTitle: litItems.title,
      itemType: litItems.type,
      itemSource: litItems.source,
      publishedAt: litItems.publishedAt,
      discoveredAt: litItems.discoveredAt,
    })
    .from(litIdeaLinks)
    .innerJoin(litItems, eq(litItems.id, litIdeaLinks.itemId))
    .where(
      user
        ? eq(litIdeaLinks.ideaId, idea.id)
        : and(
            eq(litIdeaLinks.ideaId, idea.id),
            eq(litIdeaLinks.status, "accepted"),
            eq(litItems.public, true),
          ),
    )
    .orderBy(desc(litIdeaLinks.updatedAt));

  const clarifications = user
    ? await db
        .select()
        .from(researchIdeaClarifications)
        .where(eq(researchIdeaClarifications.ideaId, idea.id))
        .orderBy(desc(researchIdeaClarifications.createdAt))
    : await db
        .select()
        .from(researchIdeaClarifications)
        .where(
          and(
            eq(researchIdeaClarifications.ideaId, idea.id),
            eq(researchIdeaClarifications.public, true),
          ),
        )
        .orderBy(desc(researchIdeaClarifications.createdAt));

  const events = user
    ? await db
        .select()
        .from(researchIdeaEvents)
        .where(eq(researchIdeaEvents.ideaId, idea.id))
        .orderBy(desc(researchIdeaEvents.createdAt))
        .limit(40)
    : await db
        .select()
        .from(researchIdeaEvents)
        .where(and(eq(researchIdeaEvents.ideaId, idea.id), eq(researchIdeaEvents.public, true)))
        .orderBy(desc(researchIdeaEvents.createdAt))
        .limit(40);

  const [related, linkOptions] = await Promise.all([
    getRelatedEntities("research_idea", idea.id, { includePrivate: !!user }),
    user ? getEntityOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-8">
        <header className="mb-6 border-b border-border pb-5">
          <Link href="/lit/ideas" className="text-[12px] text-muted hover:text-fg">
            Research ideas
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            <span className="rounded bg-subtle px-1.5 py-0.5 font-medium text-fg">
              {idea.status}
            </span>
            <span>{formatLitDate(idea.updatedAt)}</span>
          </div>
          <h1 className="mt-2 max-w-4xl text-2xl font-semibold leading-tight tracking-tight">
            {idea.title}
          </h1>
          {idea.shortSummary && (
            <p className="mt-2 max-w-4xl text-[13px] leading-relaxed text-muted">
              {idea.shortSummary}
            </p>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="flex min-w-0 flex-col gap-6">
            <MarkdownSection title="Expanded summary" body={idea.expandedSummary} />
            <MarkdownSection title="Hypothesis" body={idea.hypothesis} />
            <MarkdownSection title="Motivation" body={idea.motivation} />
            <MarkdownSection title="Next experiments" body={idea.nextExperiments} />

            <section>
              <h2 className="mb-2 text-[12px] font-semibold tracking-tight">
                Related literature
              </h2>
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-md border border-border bg-panel p-3 shadow-card"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                      <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                        {formatLitType(link.itemType)}
                      </span>
                      <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                        {link.relationType}
                      </span>
                      {user && <span>{link.status}</span>}
                      <span>{link.itemSource ?? "workflow"}</span>
                      <span>{formatLitDate(link.publishedAt ?? link.discoveredAt)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/lit/items/${link.itemId}`}
                          className="text-[13px] font-medium leading-snug hover:underline"
                        >
                          {link.itemTitle}
                        </Link>
                        {link.rationale && (
                          <p className="mt-1 text-[12px] leading-relaxed text-muted">
                            {link.rationale}
                          </p>
                        )}
                      </div>
                      {user && (
                        <LinkReviewControls linkId={link.id} initialStatus={link.status} />
                      )}
                    </div>
                  </div>
                ))}
                {links.length === 0 && (
                  <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[13px] text-muted">
                    No related literature has been accepted yet.
                  </p>
                )}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[12px] font-semibold tracking-tight">Workspace links</h2>
                {user && (
                  <EntityLinkManager
                    fromKind="research_idea"
                    fromId={idea.id}
                    options={linkOptions}
                    compact
                  />
                )}
              </div>
              <RelatedEntitiesList items={related} />
            </section>

            <section>
              <h2 className="mb-2 text-[12px] font-semibold tracking-tight">Notes</h2>
              <EntityComments entityKind="research_idea" entityId={idea.id} canPost={!!user} />
            </section>
          </main>

          <aside className="flex flex-col gap-4">
            {user && <ClarificationForm ideaId={idea.id} />}

            <section className="rounded-md border border-border bg-panel p-4">
              <h2 className="mb-3 text-[12px] font-semibold tracking-tight">Clarifications</h2>
              <div className="flex flex-col gap-2">
                {clarifications.map((clarification) => (
                  <div
                    key={clarification.id}
                    className="rounded-md border border-border bg-canvas p-2.5"
                  >
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed">
                      {clarification.body}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
                      <span>{formatLitDate(clarification.createdAt)}</span>
                      {user && <span>{clarification.public ? "public" : "private"}</span>}
                    </div>
                  </div>
                ))}
                {clarifications.length === 0 && (
                  <p className="text-[12px] text-muted">No clarifications yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-border bg-panel p-4">
              <h2 className="mb-3 text-[12px] font-semibold tracking-tight">Log</h2>
              <div className="flex flex-col gap-2">
                {events.map((event) => (
                  <div key={event.id} className="border-l border-border pl-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                      <span className="font-medium text-fg">{event.eventType}</span>
                      <span>{formatLitDate(event.createdAt)}</span>
                      {user && <span>{event.public ? "public" : "private"}</span>}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{event.body}</p>
                  </div>
                ))}
                {events.length === 0 && <p className="text-[12px] text-muted">No log entries.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MarkdownSection({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <section>
      <h2 className="mb-2 text-[12px] font-semibold tracking-tight">{title}</h2>
      <div className="prose prose-sm max-w-none dark:prose-invert prose-tight">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </section>
  );
}

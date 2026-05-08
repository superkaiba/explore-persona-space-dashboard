import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { and, desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import {
  litIdeaLinks,
  litItemDocuments,
  litItemAnalyses,
  litItemQuestions,
  litItemStates,
  litItems,
  researchIdeas,
} from "@/db/schema";
import { ItemStateForm } from "@/components/lit/ItemStateForm";
import { ItemQuestionForm } from "@/components/lit/ItemQuestionForm";
import { LinkReviewControls } from "@/components/lit/LinkReviewControls";
import { EntityComments } from "@/components/discussion/EntityComments";
import { EntityLinkManager } from "@/components/entity/EntityLinkManager";
import { RelatedEntitiesList } from "@/components/entity/RelatedEntitiesList";
import { createClient } from "@/lib/supabase/server";
import { getEntityOptions } from "@/lib/entity-options";
import { getRelatedEntities } from "@/lib/related-entities";
import {
  formatLitDate,
  formatLitType,
  formatReadStatus,
  type LitReadStatus,
} from "@/lib/lit";

export const dynamic = "force-dynamic";

export default async function LitItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [item] = await db
    .select()
    .from(litItems)
    .where(user ? eq(litItems.id, id) : and(eq(litItems.id, id), eq(litItems.public, true)))
    .limit(1);
  if (!item) notFound();

  const analyses = await db
    .select()
    .from(litItemAnalyses)
    .where(eq(litItemAnalyses.itemId, id))
    .orderBy(desc(litItemAnalyses.generatedAt), desc(litItemAnalyses.updatedAt));

  const links = await db
    .select({
      id: litIdeaLinks.id,
      relationType: litIdeaLinks.relationType,
      confidence: litIdeaLinks.confidence,
      rationale: litIdeaLinks.rationale,
      status: litIdeaLinks.status,
      ideaTitle: researchIdeas.title,
      ideaSlug: researchIdeas.slug,
    })
    .from(litIdeaLinks)
    .innerJoin(researchIdeas, eq(researchIdeas.id, litIdeaLinks.ideaId))
    .where(
      user
        ? eq(litIdeaLinks.itemId, id)
        : and(
            eq(litIdeaLinks.itemId, id),
            eq(litIdeaLinks.status, "accepted"),
            eq(researchIdeas.public, true),
          ),
    )
    .orderBy(desc(litIdeaLinks.updatedAt));

  const [state] = user
    ? await db
        .select()
        .from(litItemStates)
        .where(and(eq(litItemStates.itemId, id), eq(litItemStates.userId, user.id)))
        .limit(1)
    : [];

  const documents = user
    ? await db
        .select()
        .from(litItemDocuments)
        .where(eq(litItemDocuments.itemId, id))
        .orderBy(desc(litItemDocuments.fetchedAt), desc(litItemDocuments.updatedAt))
        .limit(3)
    : [];

  const questions = user
    ? await db
        .select()
        .from(litItemQuestions)
        .where(and(eq(litItemQuestions.itemId, id), eq(litItemQuestions.userId, user.id)))
        .orderBy(desc(litItemQuestions.createdAt))
        .limit(20)
    : [];

  const [related, linkOptions] = await Promise.all([
    getRelatedEntities("lit_item", id, { includePrivate: !!user }),
    user ? getEntityOptions() : Promise.resolve([]),
  ]);

  const primaryAnalysis = analyses[0];
  const readableDocuments = documents.filter((document) => document.textMd || document.textPlain);
  const hasFullText = readableDocuments.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-8">
        <header className="mb-6 border-b border-border pb-5">
          <Link href="/lit/items" className="text-[12px] text-muted hover:text-fg">
            Reading queue
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            <span className="rounded bg-subtle px-1.5 py-0.5 font-medium text-fg">
              {formatLitType(item.type)}
            </span>
            <span>{item.source ?? "workflow"}</span>
            <span>{formatLitDate(item.publishedAt ?? item.discoveredAt)}</span>
            {state?.readStatus && <span>{formatReadStatus(state.readStatus)}</span>}
          </div>
          <h1 className="mt-2 max-w-4xl text-2xl font-semibold leading-tight tracking-tight">
            {item.title}
          </h1>
          {item.authorsJson && item.authorsJson.length > 0 && (
            <p className="mt-2 max-w-4xl text-[13px] leading-relaxed text-muted">
              {item.authorsJson.join(", ")}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 font-medium text-fg hover:bg-subtle"
              >
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {item.pdfUrl && (
              <a
                href={item.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 font-medium text-fg hover:bg-subtle"
              >
                PDF <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="flex min-w-0 flex-col gap-6">
            {primaryAnalysis?.tldr && (
              <section className="rounded-md border border-border bg-panel p-4">
                <h2 className="mb-2 text-[12px] font-semibold tracking-tight">TL;DR</h2>
                <p className="text-[13px] leading-relaxed text-fg">{primaryAnalysis.tldr}</p>
              </section>
            )}

            {item.abstract && (
              <section>
                <h2 className="mb-2 text-[12px] font-semibold tracking-tight">Abstract</h2>
                <p className="text-[13px] leading-relaxed text-muted">{item.abstract}</p>
              </section>
            )}

            {primaryAnalysis?.analysisMd && (
              <section>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-[12px] font-semibold tracking-tight">Workflow analysis</h2>
                  {primaryAnalysis.threatLevel && (
                    <span className="rounded bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {primaryAnalysis.threatLevel}
                    </span>
                  )}
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-tight">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {primaryAnalysis.analysisMd}
                  </ReactMarkdown>
                </div>
              </section>
            )}

            {user && readableDocuments.length > 0 && (
              <section>
                <h2 className="mb-2 text-[12px] font-semibold tracking-tight">Extracted text</h2>
                <div className="flex flex-col gap-2">
                  {readableDocuments.map((document) => (
                    <details
                      key={document.id}
                      className="rounded-md border border-border bg-panel p-4"
                    >
                      <summary className="cursor-pointer text-[12px] font-medium">
                        {document.contentType ?? "document"} · {formatLitDate(document.fetchedAt)}
                      </summary>
                      <div className="prose prose-sm prose-tight mt-3 max-h-[560px] max-w-none overflow-y-auto pr-3 dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {(document.textMd ?? document.textPlain ?? "").slice(0, 150000)}
                        </ReactMarkdown>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[12px] font-semibold tracking-tight">Workspace links</h2>
                {user && (
                  <EntityLinkManager
                    fromKind="lit_item"
                    fromId={item.id}
                    options={linkOptions}
                    compact
                  />
                )}
              </div>
              <RelatedEntitiesList items={related} />
            </section>

            <section>
              <h2 className="mb-2 text-[12px] font-semibold tracking-tight">Notes</h2>
              <EntityComments entityKind="lit_item" entityId={item.id} canPost={!!user} />
            </section>
          </main>

          <aside className="flex flex-col gap-4">
            {user && (
              <ItemStateForm
                itemId={item.id}
                initialReadStatus={(state?.readStatus ?? "unread") as LitReadStatus}
                initialNotes={state?.notes ?? ""}
                initialArchived={state?.archived ?? false}
              />
            )}

            {user && (
              <ItemQuestionForm
                itemId={item.id}
                initialQuestions={questions.map((question) => ({
                  id: question.id,
                  question: question.question,
                  answerMd: question.answerMd,
                  createdAt: question.createdAt,
                }))}
                hasFullText={hasFullText}
              />
            )}

            <section className="rounded-md border border-border bg-panel p-4">
              <h2 className="mb-3 text-[12px] font-semibold tracking-tight">Related ideas</h2>
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <div key={link.id} className="rounded-md border border-border bg-canvas p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="rounded bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {link.relationType}
                      </span>
                      {user && (
                        <span className="text-[10px] font-medium text-muted">{link.status}</span>
                      )}
                    </div>
                    <Link
                      href={`/lit/ideas/${link.ideaSlug}`}
                      className="text-[12px] font-medium leading-snug hover:underline"
                    >
                      {link.ideaTitle}
                    </Link>
                    {link.rationale && (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        {link.rationale}
                      </p>
                    )}
                    {user && (
                      <div className="mt-2">
                        <LinkReviewControls linkId={link.id} initialStatus={link.status} />
                      </div>
                    )}
                  </div>
                ))}
                {links.length === 0 && (
                  <p className="text-[12px] text-muted">No related ideas yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

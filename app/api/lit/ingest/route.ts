import { NextResponse, type NextRequest } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  edges,
  litDigestRuns,
  litIdeaLinks,
  litItemDocumentChunks,
  litItemDocuments,
  litItemAnalyses,
  litItemQuestions,
  litItemStates,
  litItems,
  researchIdeaEvents,
  researchIdeas,
} from "@/db/schema";
import {
  LIT_ITEM_TYPES,
  LIT_LINK_SOURCES,
  LIT_LINK_STATUSES,
  LIT_READ_STATUSES,
  LIT_RELATION_TYPES,
  RESEARCH_IDEA_STATUSES,
  slugify,
} from "@/lib/lit";

export const runtime = "nodejs";

const nullableText = z.string().trim().max(500000).optional().nullable();

const ItemPayload = z.object({
  externalId: z.string().trim().min(1).max(500),
  type: z.enum(LIT_ITEM_TYPES).default("paper"),
  title: z.string().trim().min(1).max(5000),
  authors: z.array(z.string().trim().min(1).max(5000)).max(120).optional().nullable(),
  abstract: nullableText,
  summary: nullableText,
  url: z.string().trim().max(5000).optional().nullable(),
  pdfUrl: z.string().trim().max(5000).optional().nullable(),
  arxivId: z.string().trim().max(500).optional().nullable(),
  doi: z.string().trim().max(1000).optional().nullable(),
  source: z.string().trim().max(1000).optional().nullable(),
  sourceDetail: z.string().trim().max(5000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(1000)).max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  publishedAt: z.string().trim().optional().nullable(),
  discoveredAt: z.string().trim().optional().nullable(),
  workflowUpdatedAt: z.string().trim().optional().nullable(),
  public: z.boolean().default(false),
});

const AnalysisPayload = z.object({
  externalId: z.string().trim().min(1).max(500).optional().nullable(),
  itemExternalId: z.string().trim().min(1).max(500),
  analysisMd: nullableText,
  tldr: nullableText,
  threatLevel: z.string().trim().max(5000).optional().nullable(),
  readSignal: z.string().trim().max(5000).optional().nullable(),
  section: z.string().trim().max(5000).optional().nullable(),
  aimTag: z.string().trim().max(5000).optional().nullable(),
  sourcePath: z.string().trim().max(5000).optional().nullable(),
  generatedAt: z.string().trim().optional().nullable(),
});

const IdeaPayload = z.object({
  externalId: z.string().trim().min(1).max(500),
  slug: z.string().trim().min(1).max(120).optional().nullable(),
  title: z.string().trim().min(1).max(5000),
  status: z.enum(RESEARCH_IDEA_STATUSES).default("seed"),
  shortSummary: nullableText,
  expandedSummary: nullableText,
  hypothesis: nullableText,
  motivation: nullableText,
  nextExperiments: nullableText,
  sourcePath: z.string().trim().max(5000).optional().nullable(),
  public: z.boolean().default(false),
  updatedAt: z.string().trim().optional().nullable(),
});

const LinkPayload = z.object({
  ideaExternalId: z.string().trim().min(1).max(500).optional().nullable(),
  ideaSlug: z.string().trim().min(1).max(120).optional().nullable(),
  itemExternalId: z.string().trim().min(1).max(500),
  relationType: z.enum(LIT_RELATION_TYPES).default("background"),
  confidence: z.number().min(0).max(1).optional().nullable(),
  rationale: nullableText,
  status: z.enum(LIT_LINK_STATUSES).default("proposed"),
  source: z.enum(LIT_LINK_SOURCES).default("auto"),
});

const RunPayload = z.object({
  runDate: z.string().trim().min(1).max(100),
  status: z.string().trim().max(100).default("imported"),
  startedAt: z.string().trim().optional().nullable(),
  finishedAt: z.string().trim().optional().nullable(),
  candidateCount: z.number().int().nonnegative().optional().nullable(),
  selectedCount: z.number().int().nonnegative().optional().nullable(),
  logPath: z.string().trim().max(5000).optional().nullable(),
  summaryMd: nullableText,
  notificationStatus: z.string().trim().max(5000).optional().nullable(),
});

const EventPayload = z.object({
  externalId: z.string().trim().min(1).max(500).optional().nullable(),
  ideaExternalId: z.string().trim().min(1).max(500).optional().nullable(),
  ideaSlug: z.string().trim().min(1).max(120).optional().nullable(),
  eventType: z.string().trim().min(1).max(5000),
  body: z.string().trim().min(1).max(500000),
  public: z.boolean().default(false),
  createdAt: z.string().trim().optional().nullable(),
});

const StatePayload = z.object({
  itemExternalId: z.string().trim().min(1).max(500),
  userId: z.string().uuid(),
  userEmail: z.string().trim().max(500).optional().nullable(),
  readStatus: z.enum(LIT_READ_STATUSES).default("unread"),
  notes: nullableText,
  archived: z.boolean().default(false),
  readAt: z.string().trim().optional().nullable(),
});

const DocumentPayload = z.object({
  externalId: z.string().trim().min(1).max(500),
  itemExternalId: z.string().trim().min(1).max(500),
  sourceUrl: z.string().trim().max(5000).optional().nullable(),
  contentType: z.string().trim().max(500).optional().nullable(),
  status: z.string().trim().max(100).default("fetched"),
  textMd: nullableText,
  textPlain: nullableText,
  textSha256: z.string().trim().max(500).optional().nullable(),
  error: nullableText,
  fetchedAt: z.string().trim().optional().nullable(),
  chunkCount: z.number().int().nonnegative().optional().nullable(),
});

const ChunkPayload = z.object({
  documentExternalId: z.string().trim().min(1).max(500),
  itemExternalId: z.string().trim().min(1).max(500),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().trim().min(1).max(50000),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const QuestionPayload = z.object({
  itemExternalId: z.string().trim().min(1).max(500),
  question: z.string().trim().min(1).max(20000),
  answerMd: nullableText,
  citations: z.array(z.record(z.unknown())).max(100).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  userEmail: z.string().trim().max(500).optional().nullable(),
  createdAt: z.string().trim().optional().nullable(),
});

const IngestPayload = z.object({
  items: z.array(ItemPayload).max(1000).default([]),
  analyses: z.array(AnalysisPayload).max(1000).default([]),
  ideas: z.array(IdeaPayload).max(500).default([]),
  links: z.array(LinkPayload).max(2000).default([]),
  runs: z.array(RunPayload).max(200).default([]),
  events: z.array(EventPayload).max(2000).default([]),
  states: z.array(StatePayload).max(2000).default([]),
  documents: z.array(DocumentPayload).max(200).default([]),
  chunks: z.array(ChunkPayload).max(2000).default([]),
  questions: z.array(QuestionPayload).max(500).default([]),
});

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest) {
  const secret = process.env.LIT_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "LIT_INGEST_SECRET is not configured" }, { status: 500 });
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof IngestPayload>;
  try {
    const body = await req.json();
    const result = IngestPayload.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  const itemExternalToId = new Map<string, string>();
  const ideaKeyToId = new Map<string, string>();
  const documentExternalToId = new Map<string, string>();

  const excluded = (column: string) => sql.raw(`excluded.${column}`);
  const chunk = <T,>(values: T[], size = 500) => {
    const batches: T[][] = [];
    for (let i = 0; i < values.length; i += size) batches.push(values.slice(i, i + size));
    return batches;
  };
  const uniqueTexts = (values: Iterable<string | null | undefined>) => {
    const seen = new Set<string>();
    for (const value of values) {
      const text = value?.trim();
      if (text) seen.add(text);
    }
    return Array.from(seen);
  };
  const dedupeBy = <T,>(
    values: T[],
    keyFn: (value: T) => string | null | undefined,
  ) => {
    const byKey = new Map<string, T>();
    for (const value of values) {
      const key = keyFn(value);
      if (key) byKey.set(key, value);
    }
    return Array.from(byKey.values());
  };

  const loadItemIds = async (externalIds: Iterable<string | null | undefined>) => {
    const missing = uniqueTexts(externalIds).filter((id) => !itemExternalToId.has(id));
    for (const batch of chunk(missing)) {
      const rows = await db
        .select({ id: litItems.id, externalId: litItems.externalId })
        .from(litItems)
        .where(inArray(litItems.externalId, batch));
      for (const row of rows) itemExternalToId.set(row.externalId, row.id);
    }
  };

  const loadIdeaIds = async (
    refs: Iterable<{ externalId?: string | null; slug?: string | null }>,
  ) => {
    const allRefs = Array.from(refs);
    const externalIds = uniqueTexts(allRefs.map((ref) => ref.externalId)).filter(
      (id) => !ideaKeyToId.has(id),
    );
    const slugs = uniqueTexts(allRefs.map((ref) => ref.slug)).filter(
      (slug) => !ideaKeyToId.has(slug),
    );

    for (const batch of chunk(externalIds)) {
      const rows = await db
        .select({ id: researchIdeas.id, externalId: researchIdeas.externalId, slug: researchIdeas.slug })
        .from(researchIdeas)
        .where(inArray(researchIdeas.externalId, batch));
      for (const row of rows) {
        ideaKeyToId.set(row.externalId, row.id);
        ideaKeyToId.set(row.slug, row.id);
      }
    }

    for (const batch of chunk(slugs)) {
      const rows = await db
        .select({ id: researchIdeas.id, externalId: researchIdeas.externalId, slug: researchIdeas.slug })
        .from(researchIdeas)
        .where(inArray(researchIdeas.slug, batch));
      for (const row of rows) {
        ideaKeyToId.set(row.externalId, row.id);
        ideaKeyToId.set(row.slug, row.id);
      }
    }
  };

  const loadDocumentIds = async (externalIds: Iterable<string | null | undefined>) => {
    const missing = uniqueTexts(externalIds).filter((id) => !documentExternalToId.has(id));
    for (const batch of chunk(missing)) {
      const rows = await db
        .select({ id: litItemDocuments.id, externalId: litItemDocuments.externalId })
        .from(litItemDocuments)
        .where(inArray(litItemDocuments.externalId, batch));
      for (const row of rows) documentExternalToId.set(row.externalId, row.id);
    }
  };

  const items = dedupeBy(parsed.items, (item) => item.externalId);
  if (items.length > 0) {
    const rows = await db
      .insert(litItems)
      .values(
        items.map((item) => ({
          externalId: item.externalId,
          type: item.type,
          title: item.title,
          authorsJson: item.authors ?? null,
          abstract: item.abstract ?? null,
          summary: item.summary ?? null,
          url: item.url ?? null,
          pdfUrl: item.pdfUrl ?? null,
          arxivId: item.arxivId ?? null,
          doi: item.doi ?? null,
          source: item.source ?? null,
          sourceDetail: item.sourceDetail ?? null,
          tagsJson: item.tags ?? null,
          metadataJson: item.metadata ?? null,
          publishedAt: asDate(item.publishedAt),
          discoveredAt: asDate(item.discoveredAt) ?? now,
          workflowUpdatedAt: asDate(item.workflowUpdatedAt),
          public: item.public,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: litItems.externalId,
        set: {
          type: excluded("type"),
          title: excluded("title"),
          authorsJson: excluded("authors_json"),
          abstract: excluded("abstract"),
          summary: excluded("summary"),
          url: excluded("url"),
          pdfUrl: excluded("pdf_url"),
          arxivId: excluded("arxiv_id"),
          doi: excluded("doi"),
          source: excluded("source"),
          sourceDetail: excluded("source_detail"),
          tagsJson: excluded("tags_json"),
          metadataJson: excluded("metadata_json"),
          publishedAt: excluded("published_at"),
          workflowUpdatedAt: excluded("workflow_updated_at"),
          public: excluded("public"),
          updatedAt: excluded("updated_at"),
        },
      })
      .returning({ id: litItems.id, externalId: litItems.externalId });
    for (const row of rows) itemExternalToId.set(row.externalId, row.id);
  }

  const ideas = dedupeBy(parsed.ideas, (idea) => idea.externalId);
  if (ideas.length > 0) {
    const rows = await db
      .insert(researchIdeas)
      .values(
        ideas.map((idea) => ({
          externalId: idea.externalId,
          slug: idea.slug ?? slugify(idea.title),
          title: idea.title,
          status: idea.status,
          shortSummary: idea.shortSummary ?? null,
          expandedSummary: idea.expandedSummary ?? null,
          hypothesis: idea.hypothesis ?? null,
          motivation: idea.motivation ?? null,
          nextExperiments: idea.nextExperiments ?? null,
          sourcePath: idea.sourcePath ?? null,
          public: idea.public,
          createdAt: now,
          updatedAt: asDate(idea.updatedAt) ?? now,
        })),
      )
      .onConflictDoUpdate({
        target: researchIdeas.externalId,
        set: {
          slug: excluded("slug"),
          title: excluded("title"),
          status: excluded("status"),
          shortSummary: excluded("short_summary"),
          expandedSummary: excluded("expanded_summary"),
          hypothesis: excluded("hypothesis"),
          motivation: excluded("motivation"),
          nextExperiments: excluded("next_experiments"),
          sourcePath: excluded("source_path"),
          public: excluded("public"),
          updatedAt: excluded("updated_at"),
        },
      })
      .returning({
        id: researchIdeas.id,
        externalId: researchIdeas.externalId,
        slug: researchIdeas.slug,
      });
    for (const row of rows) {
      ideaKeyToId.set(row.externalId, row.id);
      ideaKeyToId.set(row.slug, row.id);
    }
  }

  let skippedAnalyses = 0;
  await loadItemIds(parsed.analyses.map((analysis) => analysis.itemExternalId));
  const analysesByExternalId = new Map<string, typeof litItemAnalyses.$inferInsert>();
  for (const analysis of parsed.analyses) {
    const itemId = itemExternalToId.get(analysis.itemExternalId);
    if (!itemId) {
      skippedAnalyses += 1;
      continue;
    }
    const externalId =
      analysis.externalId ?? analysis.sourcePath ?? `${analysis.itemExternalId}:analysis`;
    analysesByExternalId.set(externalId, {
      externalId,
      itemId,
      analysisMd: analysis.analysisMd ?? null,
      tldr: analysis.tldr ?? null,
      threatLevel: analysis.threatLevel ?? null,
      readSignal: analysis.readSignal ?? null,
      section: analysis.section ?? null,
      aimTag: analysis.aimTag ?? null,
      sourcePath: analysis.sourcePath ?? null,
      generatedAt: asDate(analysis.generatedAt),
      createdAt: now,
      updatedAt: now,
    });
  }
  const analysisRows = Array.from(analysesByExternalId.values());
  if (analysisRows.length > 0) {
    await db
      .insert(litItemAnalyses)
      .values(analysisRows)
      .onConflictDoUpdate({
        target: litItemAnalyses.externalId,
        set: {
          itemId: excluded("item_id"),
          analysisMd: excluded("analysis_md"),
          tldr: excluded("tldr"),
          threatLevel: excluded("threat_level"),
          readSignal: excluded("read_signal"),
          section: excluded("section"),
          aimTag: excluded("aim_tag"),
          sourcePath: excluded("source_path"),
          generatedAt: excluded("generated_at"),
          updatedAt: excluded("updated_at"),
        },
      });
  }

  const runs = dedupeBy(parsed.runs, (run) => run.runDate);
  if (runs.length > 0) {
    await db
      .insert(litDigestRuns)
      .values(
        runs.map((run) => ({
          runDate: run.runDate,
          status: run.status,
          startedAt: asDate(run.startedAt),
          finishedAt: asDate(run.finishedAt),
          candidateCount: run.candidateCount ?? null,
          selectedCount: run.selectedCount ?? null,
          logPath: run.logPath ?? null,
          summaryMd: run.summaryMd ?? null,
          notificationStatus: run.notificationStatus ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: litDigestRuns.runDate,
        set: {
          status: excluded("status"),
          startedAt: excluded("started_at"),
          finishedAt: excluded("finished_at"),
          candidateCount: excluded("candidate_count"),
          selectedCount: excluded("selected_count"),
          logPath: excluded("log_path"),
          summaryMd: excluded("summary_md"),
          notificationStatus: excluded("notification_status"),
          updatedAt: excluded("updated_at"),
        },
      });
  }

  let skippedLinks = 0;
  await loadIdeaIds(parsed.links.map((link) => ({ externalId: link.ideaExternalId, slug: link.ideaSlug })));
  await loadItemIds(parsed.links.map((link) => link.itemExternalId));
  const linkRowsByKey = new Map<string, typeof litIdeaLinks.$inferInsert>();
  for (const link of parsed.links) {
    const ideaId =
      (link.ideaExternalId ? ideaKeyToId.get(link.ideaExternalId) : undefined) ??
      (link.ideaSlug ? ideaKeyToId.get(link.ideaSlug) : undefined);
    const itemId = itemExternalToId.get(link.itemExternalId);
    if (!ideaId || !itemId) {
      skippedLinks += 1;
      continue;
    }
    linkRowsByKey.set(`${ideaId}:${itemId}:${link.relationType}`, {
      ideaId,
      itemId,
      relationType: link.relationType,
      confidence: link.confidence ?? null,
      rationale: link.rationale ?? null,
      status: link.status,
      source: link.source,
      createdAt: now,
      updatedAt: now,
    });
  }
  const linkRows = Array.from(linkRowsByKey.values());
  if (linkRows.length > 0) {
    await db
      .insert(litIdeaLinks)
      .values(linkRows)
      .onConflictDoUpdate({
        target: [litIdeaLinks.ideaId, litIdeaLinks.itemId, litIdeaLinks.relationType],
        set: {
          confidence: excluded("confidence"),
          rationale: excluded("rationale"),
          source: excluded("source"),
          status: sql`case when ${litIdeaLinks.status} != 'proposed' and excluded.status = 'proposed' then ${litIdeaLinks.status} else excluded.status end`,
          updatedAt: excluded("updated_at"),
        },
      });

    const acceptedEdgeRows = linkRows
      .filter((link) => link.status === "accepted")
      .map((link) => ({
        fromKind: "research_idea" as const,
        fromId: link.ideaId,
        toKind: "lit_item" as const,
        toId: link.itemId,
        type: link.relationType ?? "background",
      }));
    if (acceptedEdgeRows.length > 0) {
      await db.insert(edges).values(acceptedEdgeRows).onConflictDoNothing();
    }
  }

  let skippedEvents = 0;
  await loadIdeaIds(parsed.events.map((event) => ({ externalId: event.ideaExternalId, slug: event.ideaSlug })));
  const eventRowsByExternalId = new Map<string, typeof researchIdeaEvents.$inferInsert>();
  const eventRowsWithoutExternalId: (typeof researchIdeaEvents.$inferInsert)[] = [];
  for (const event of parsed.events) {
    const ideaId =
      (event.ideaExternalId ? ideaKeyToId.get(event.ideaExternalId) : undefined) ??
      (event.ideaSlug ? ideaKeyToId.get(event.ideaSlug) : undefined);
    if (!ideaId) {
      skippedEvents += 1;
      continue;
    }
    const values = {
      externalId: event.externalId ?? null,
      ideaId,
      eventType: event.eventType,
      body: event.body,
      public: event.public,
      createdAt: asDate(event.createdAt) ?? now,
    };
    if (event.externalId) eventRowsByExternalId.set(event.externalId, values);
    else eventRowsWithoutExternalId.push(values);
  }
  const eventRows = Array.from(eventRowsByExternalId.values());
  if (eventRows.length > 0) {
    await db
      .insert(researchIdeaEvents)
      .values(eventRows)
      .onConflictDoUpdate({
        target: researchIdeaEvents.externalId,
        set: {
          ideaId: excluded("idea_id"),
          eventType: excluded("event_type"),
          body: excluded("body"),
          public: excluded("public"),
          createdAt: excluded("created_at"),
        },
      });
  }
  if (eventRowsWithoutExternalId.length > 0) {
    await db.insert(researchIdeaEvents).values(eventRowsWithoutExternalId);
  }

  let skippedStates = 0;
  await loadItemIds(parsed.states.map((state) => state.itemExternalId));
  const stateRowsByKey = new Map<string, typeof litItemStates.$inferInsert>();
  for (const state of parsed.states) {
    const itemId = itemExternalToId.get(state.itemExternalId);
    if (!itemId) {
      skippedStates += 1;
      continue;
    }

    const readAt =
      state.readStatus === "read" ? asDate(state.readAt) ?? now : asDate(state.readAt);

    stateRowsByKey.set(`${itemId}:${state.userId}`, {
      itemId,
      userId: state.userId,
      userEmail: state.userEmail ?? null,
      readStatus: state.readStatus,
      notes: state.notes ?? null,
      archived: state.archived,
      readAt,
      createdAt: now,
      updatedAt: now,
    });
  }
  const stateRows = Array.from(stateRowsByKey.values());
  if (stateRows.length > 0) {
    await db
      .insert(litItemStates)
      .values(stateRows)
      .onConflictDoUpdate({
        target: [litItemStates.itemId, litItemStates.userId],
        set: {
          userEmail: excluded("user_email"),
          readStatus: excluded("read_status"),
          notes: excluded("notes"),
          archived: excluded("archived"),
          readAt: excluded("read_at"),
          updatedAt: excluded("updated_at"),
        },
      });
  }

  let skippedDocuments = 0;
  await loadItemIds(parsed.documents.map((document) => document.itemExternalId));
  const documentRowsByExternalId = new Map<string, typeof litItemDocuments.$inferInsert>();
  const documentChunkCounts = new Map<string, number>();
  for (const document of parsed.documents) {
    const itemId = itemExternalToId.get(document.itemExternalId);
    if (!itemId) {
      skippedDocuments += 1;
      continue;
    }
    documentRowsByExternalId.set(document.externalId, {
      externalId: document.externalId,
      itemId,
      sourceUrl: document.sourceUrl ?? null,
      contentType: document.contentType ?? null,
      status: document.status,
      textMd: document.textMd ?? null,
      textPlain: document.textPlain ?? null,
      textSha256: document.textSha256 ?? null,
      error: document.error ?? null,
      fetchedAt: asDate(document.fetchedAt),
      createdAt: now,
      updatedAt: now,
    });
    if (document.chunkCount != null) documentChunkCounts.set(document.externalId, document.chunkCount);
  }
  const documentRows = Array.from(documentRowsByExternalId.values());
  if (documentRows.length > 0) {
    const rows = await db
      .insert(litItemDocuments)
      .values(documentRows)
      .onConflictDoUpdate({
        target: litItemDocuments.externalId,
        set: {
          itemId: excluded("item_id"),
          sourceUrl: excluded("source_url"),
          contentType: excluded("content_type"),
          status: excluded("status"),
          textMd: excluded("text_md"),
          textPlain: excluded("text_plain"),
          textSha256: excluded("text_sha256"),
          error: excluded("error"),
          fetchedAt: excluded("fetched_at"),
          updatedAt: excluded("updated_at"),
        },
      })
      .returning({ id: litItemDocuments.id, externalId: litItemDocuments.externalId });
    for (const row of rows) documentExternalToId.set(row.externalId, row.id);

    for (const [externalId, chunkCount] of documentChunkCounts) {
      const documentId = documentExternalToId.get(externalId);
      if (!documentId) continue;
      await db
        .delete(litItemDocumentChunks)
        .where(sql`${litItemDocumentChunks.documentId} = ${documentId} and ${litItemDocumentChunks.chunkIndex} >= ${chunkCount}`);
    }
  }

  let skippedChunks = 0;
  await loadDocumentIds(parsed.chunks.map((chunk) => chunk.documentExternalId));
  await loadItemIds(parsed.chunks.map((chunk) => chunk.itemExternalId));
  const chunkRowsByKey = new Map<string, typeof litItemDocumentChunks.$inferInsert>();
  for (const docChunk of parsed.chunks) {
    const documentId = documentExternalToId.get(docChunk.documentExternalId);
    const itemId = itemExternalToId.get(docChunk.itemExternalId);
    if (!documentId || !itemId) {
      skippedChunks += 1;
      continue;
    }
    chunkRowsByKey.set(`${documentId}:${docChunk.chunkIndex}`, {
      documentId,
      itemId,
      chunkIndex: docChunk.chunkIndex,
      text: docChunk.text,
      metadataJson: docChunk.metadata ?? null,
      createdAt: now,
    });
  }
  const chunkRows = Array.from(chunkRowsByKey.values());
  if (chunkRows.length > 0) {
    await db
      .insert(litItemDocumentChunks)
      .values(chunkRows)
      .onConflictDoUpdate({
        target: [litItemDocumentChunks.documentId, litItemDocumentChunks.chunkIndex],
        set: {
          itemId: excluded("item_id"),
          text: excluded("text"),
          metadataJson: excluded("metadata_json"),
          createdAt: excluded("created_at"),
        },
      });
  }

  let skippedQuestions = 0;
  await loadItemIds(parsed.questions.map((question) => question.itemExternalId));
  const questionRows: (typeof litItemQuestions.$inferInsert)[] = [];
  for (const question of parsed.questions) {
    const itemId = itemExternalToId.get(question.itemExternalId);
    if (!itemId) {
      skippedQuestions += 1;
      continue;
    }
    questionRows.push({
      itemId,
      question: question.question,
      answerMd: question.answerMd ?? null,
      citationsJson: question.citations ?? null,
      userId: question.userId ?? null,
      userEmail: question.userEmail ?? null,
      createdAt: asDate(question.createdAt) ?? now,
    });
  }
  if (questionRows.length > 0) {
    await db.insert(litItemQuestions).values(questionRows);
  }

  if (parsed.events.length === 0 && parsed.links.length > 0) {
    const ideaIds = Array.from(new Set(Array.from(ideaKeyToId.values())));
    for (const ideaId of ideaIds.slice(0, 50)) {
      await db.insert(researchIdeaEvents).values({
        ideaId,
        eventType: "workflow_ingest",
        body: "Updated from the literature workflow.",
        public: true,
        createdAt: now,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    counts: {
      items: parsed.items.length,
      analyses: parsed.analyses.length,
      ideas: parsed.ideas.length,
      links: parsed.links.length,
      runs: parsed.runs.length,
      events: parsed.events.length,
      states: parsed.states.length,
      documents: parsed.documents.length,
      chunks: parsed.chunks.length,
      questions: parsed.questions.length,
      skippedAnalyses,
      skippedLinks,
      skippedEvents,
      skippedStates,
      skippedDocuments,
      skippedChunks,
      skippedQuestions,
    },
  });
}

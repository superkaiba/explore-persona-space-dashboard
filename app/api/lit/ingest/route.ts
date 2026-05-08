import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  litDigestRuns,
  litIdeaLinks,
  litItemAnalyses,
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
  public: z.boolean().default(true),
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
  public: z.boolean().default(true),
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
  public: z.boolean().default(true),
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

const IngestPayload = z.object({
  items: z.array(ItemPayload).max(1000).default([]),
  analyses: z.array(AnalysisPayload).max(1000).default([]),
  ideas: z.array(IdeaPayload).max(500).default([]),
  links: z.array(LinkPayload).max(2000).default([]),
  runs: z.array(RunPayload).max(200).default([]),
  events: z.array(EventPayload).max(2000).default([]),
  states: z.array(StatePayload).max(2000).default([]),
});

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveItemId(
  externalId: string,
  map: Map<string, string>,
): Promise<string | null> {
  const mapped = map.get(externalId);
  if (mapped) return mapped;
  const db = getDb();
  const [row] = await db
    .select({ id: litItems.id, externalId: litItems.externalId })
    .from(litItems)
    .where(eq(litItems.externalId, externalId))
    .limit(1);
  if (!row) return null;
  map.set(row.externalId, row.id);
  return row.id;
}

async function resolveIdeaId(
  input: { externalId?: string | null; slug?: string | null },
  map: Map<string, string>,
): Promise<string | null> {
  const key = input.externalId ?? input.slug ?? "";
  const mapped = map.get(key);
  if (mapped) return mapped;

  const db = getDb();
  const rows = input.externalId
    ? await db
        .select({ id: researchIdeas.id, externalId: researchIdeas.externalId, slug: researchIdeas.slug })
        .from(researchIdeas)
        .where(eq(researchIdeas.externalId, input.externalId))
        .limit(1)
    : input.slug
      ? await db
          .select({ id: researchIdeas.id, externalId: researchIdeas.externalId, slug: researchIdeas.slug })
          .from(researchIdeas)
          .where(eq(researchIdeas.slug, input.slug))
          .limit(1)
      : [];

  const row = rows[0];
  if (!row) return null;
  map.set(row.externalId, row.id);
  map.set(row.slug, row.id);
  return row.id;
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

  for (const item of parsed.items) {
    const [row] = await db
      .insert(litItems)
      .values({
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
      })
      .onConflictDoUpdate({
        target: litItems.externalId,
        set: {
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
          workflowUpdatedAt: asDate(item.workflowUpdatedAt),
          public: item.public,
          updatedAt: now,
        },
      })
      .returning({ id: litItems.id, externalId: litItems.externalId });
    itemExternalToId.set(row.externalId, row.id);
  }

  for (const idea of parsed.ideas) {
    const slug = idea.slug ?? slugify(idea.title);
    const [row] = await db
      .insert(researchIdeas)
      .values({
        externalId: idea.externalId,
        slug,
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
      })
      .onConflictDoUpdate({
        target: researchIdeas.externalId,
        set: {
          slug,
          title: idea.title,
          status: idea.status,
          shortSummary: idea.shortSummary ?? null,
          expandedSummary: idea.expandedSummary ?? null,
          hypothesis: idea.hypothesis ?? null,
          motivation: idea.motivation ?? null,
          nextExperiments: idea.nextExperiments ?? null,
          sourcePath: idea.sourcePath ?? null,
          public: idea.public,
          updatedAt: asDate(idea.updatedAt) ?? now,
        },
      })
      .returning({
        id: researchIdeas.id,
        externalId: researchIdeas.externalId,
        slug: researchIdeas.slug,
      });
    ideaKeyToId.set(row.externalId, row.id);
    ideaKeyToId.set(row.slug, row.id);
  }

  let skippedAnalyses = 0;
  for (const analysis of parsed.analyses) {
    const itemId = await resolveItemId(analysis.itemExternalId, itemExternalToId);
    if (!itemId) {
      skippedAnalyses += 1;
      continue;
    }
    const externalId =
      analysis.externalId ?? analysis.sourcePath ?? `${analysis.itemExternalId}:analysis`;
    await db
      .insert(litItemAnalyses)
      .values({
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
      })
      .onConflictDoUpdate({
        target: litItemAnalyses.externalId,
        set: {
          itemId,
          analysisMd: analysis.analysisMd ?? null,
          tldr: analysis.tldr ?? null,
          threatLevel: analysis.threatLevel ?? null,
          readSignal: analysis.readSignal ?? null,
          section: analysis.section ?? null,
          aimTag: analysis.aimTag ?? null,
          sourcePath: analysis.sourcePath ?? null,
          generatedAt: asDate(analysis.generatedAt),
          updatedAt: now,
        },
      });
  }

  let skippedLinks = 0;
  for (const link of parsed.links) {
    const ideaId = await resolveIdeaId(
      { externalId: link.ideaExternalId, slug: link.ideaSlug },
      ideaKeyToId,
    );
    const itemId = await resolveItemId(link.itemExternalId, itemExternalToId);
    if (!ideaId || !itemId) {
      skippedLinks += 1;
      continue;
    }

    const [existing] = await db
      .select({ id: litIdeaLinks.id, status: litIdeaLinks.status })
      .from(litIdeaLinks)
      .where(
        and(
          eq(litIdeaLinks.ideaId, ideaId),
          eq(litIdeaLinks.itemId, itemId),
          eq(litIdeaLinks.relationType, link.relationType),
        ),
      )
      .limit(1);

    const nextStatus =
      existing?.status && existing.status !== "proposed" && link.status === "proposed"
        ? existing.status
        : link.status;

    if (existing) {
      await db
        .update(litIdeaLinks)
        .set({
          confidence: link.confidence ?? null,
          rationale: link.rationale ?? null,
          source: link.source,
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(litIdeaLinks.id, existing.id));
    } else {
      await db.insert(litIdeaLinks).values({
        ideaId,
        itemId,
        relationType: link.relationType,
        confidence: link.confidence ?? null,
        rationale: link.rationale ?? null,
        status: nextStatus,
        source: link.source,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const run of parsed.runs) {
    await db
      .insert(litDigestRuns)
      .values({
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
      })
      .onConflictDoUpdate({
        target: litDigestRuns.runDate,
        set: {
          status: run.status,
          startedAt: asDate(run.startedAt),
          finishedAt: asDate(run.finishedAt),
          candidateCount: run.candidateCount ?? null,
          selectedCount: run.selectedCount ?? null,
          logPath: run.logPath ?? null,
          summaryMd: run.summaryMd ?? null,
          notificationStatus: run.notificationStatus ?? null,
          updatedAt: now,
        },
      });
  }

  let skippedEvents = 0;
  for (const event of parsed.events) {
    const ideaId = await resolveIdeaId(
      { externalId: event.ideaExternalId, slug: event.ideaSlug },
      ideaKeyToId,
    );
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

    if (event.externalId) {
      await db
        .insert(researchIdeaEvents)
        .values(values)
        .onConflictDoUpdate({
          target: researchIdeaEvents.externalId,
          set: {
            ideaId,
            eventType: event.eventType,
            body: event.body,
            public: event.public,
            createdAt: asDate(event.createdAt) ?? now,
          },
        });
    } else {
      await db.insert(researchIdeaEvents).values(values);
    }
  }

  let skippedStates = 0;
  for (const state of parsed.states) {
    const itemId = await resolveItemId(state.itemExternalId, itemExternalToId);
    if (!itemId) {
      skippedStates += 1;
      continue;
    }

    const readAt =
      state.readStatus === "read" ? asDate(state.readAt) ?? now : asDate(state.readAt);

    await db
      .insert(litItemStates)
      .values({
        itemId,
        userId: state.userId,
        userEmail: state.userEmail ?? null,
        readStatus: state.readStatus,
        notes: state.notes ?? null,
        archived: state.archived,
        readAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [litItemStates.itemId, litItemStates.userId],
        set: {
          userEmail: state.userEmail ?? null,
          readStatus: state.readStatus,
          notes: state.notes ?? null,
          archived: state.archived,
          readAt,
          updatedAt: now,
        },
      });
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
      skippedAnalyses,
      skippedLinks,
      skippedEvents,
      skippedStates,
    },
  });
}

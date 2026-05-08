import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const confidenceEnum = pgEnum("confidence", ["HIGH", "MODERATE", "LOW"]);

export const claimStatusEnum = pgEnum("claim_status", [
  "draft",
  "finalized",
  "retracted",
]);

export const experimentStatusEnum = pgEnum("experiment_status", [
  "proposed",
  "planning",
  "plan_pending",
  "approved",
  "implementing",
  "code_reviewing",
  "running",
  "uploading",
  "interpreting",
  "reviewing",
  "awaiting_promotion",
  "done_experiment",
  "done_impl",
  "blocked",
  "archived",
]);

export const edgeTypeEnum = pgEnum("edge_type", [
  "parent",
  "child",
  "sibling",
  "supports",
  "contradicts",
  "derives_from",
]);

export const entityKindEnum = pgEnum("entity_kind", [
  "claim",
  "experiment",
  "run",
  "todo",
]);

export const todoStatusEnum = pgEnum("todo_status", [
  "inbox",
  "scoped",
  "planning",
  "open",
  "in_progress",
  "running",
  "interpreting",
  "awaiting_promotion",
  "blocked",
  "done",
  "cancelled",
  "archived",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "tool",
]);

export const litItemTypeEnum = pgEnum("lit_item_type", [
  "paper",
  "blog_post",
  "forum_post",
  "newsletter",
  "report",
  "repo",
  "video",
  "other",
]);

export const litReadStatusEnum = pgEnum("lit_read_status", [
  "unread",
  "skimmed",
  "read",
]);

export const litRelationTypeEnum = pgEnum("lit_relation_type", [
  "supports",
  "contradicts",
  "method",
  "baseline",
  "background",
  "threat",
  "inspiration",
]);

export const litLinkStatusEnum = pgEnum("lit_link_status", [
  "proposed",
  "accepted",
  "rejected",
]);

export const litLinkSourceEnum = pgEnum("lit_link_source", [
  "auto",
  "manual",
]);

export const researchIdeaStatusEnum = pgEnum("research_idea_status", [
  "seed",
  "active",
  "paused",
  "developed",
  "abandoned",
]);

export const claims = pgTable("claim", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  confidence: confidenceEnum("confidence"),
  status: claimStatusEnum("status").notNull().default("draft"),
  bodyJson: jsonb("body_json"),
  heroFigureId: uuid("hero_figure_id"),
  githubIssueNumber: integer("github_issue_number").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const experiments = pgTable("experiment", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  hypothesis: text("hypothesis"),
  planJson: jsonb("plan_json"),
  status: experimentStatusEnum("status").notNull().default("proposed"),
  podName: text("pod_name"),
  parentId: uuid("parent_id"),
  claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),
  githubIssueNumber: integer("github_issue_number").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const runs = pgTable("run", {
  id: uuid("id").primaryKey().defaultRandom(),
  experimentId: uuid("experiment_id")
    .references(() => experiments.id, { onDelete: "cascade" })
    .notNull(),
  seed: integer("seed"),
  configYaml: text("config_yaml"),
  wandbUrl: text("wandb_url"),
  hfUrl: text("hf_url"),
  metricsJson: jsonb("metrics_json"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const todos = pgTable("todo", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  due: timestamp("due", { withTimezone: true }),
  status: todoStatusEnum("status").notNull().default("inbox"),
  kind: text("kind").notNull().default("proposed"),
  intentMode: text("intent_mode").notNull().default("exploratory"),
  intentSummary: text("intent_summary"),
  usefulIf: text("useful_if"),
  priority: text("priority").notNull().default("normal"),
  ownerNote: text("owner_note"),
  linkedKind: entityKindEnum("linked_kind"),
  linkedId: uuid("linked_id"),
  githubIssueNumber: integer("github_issue_number").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const edges = pgTable(
  "edge",
  {
    fromKind: entityKindEnum("from_kind").notNull(),
    fromId: uuid("from_id").notNull(),
    toKind: entityKindEnum("to_kind").notNull(),
    toId: uuid("to_id").notNull(),
    type: edgeTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fromKind, t.fromId, t.toKind, t.toId, t.type] }),
    fromIdx: index("edge_from_idx").on(t.fromKind, t.fromId),
    toIdx: index("edge_to_idx").on(t.toKind, t.toId),
  }),
);

export const figures = pgTable("figure", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  caption: text("caption"),
  entityKind: entityKindEnum("entity_kind").notNull(),
  entityId: uuid("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comments = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorKind: text("author_kind").notNull(),
    author: text("author").notNull(),
    authorUserId: uuid("author_user_id"),
    authorEmail: text("author_email"),
    body: text("body").notNull(),
    entityKind: entityKindEnum("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    entityIdx: index("comment_entity_idx").on(t.entityKind, t.entityId, t.createdAt),
  }),
);

export const agentTasks = pgTable(
  "agent_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agent: text("agent").notNull(),
    stage: text("stage").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    entityKind: entityKindEnum("entity_kind").notNull(),
    entityId: uuid("entity_id").notNull(),
  },
  (t) => ({
    liveIdx: index("agent_task_live_idx").on(t.completedAt, t.heartbeatAt),
  }),
);

export const chatSessions = pgTable("chat_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeEntityKind: entityKindEnum("scope_entity_kind"),
  scopeEntityId: uuid("scope_entity_id"),
  agentHandle: text("agent_handle"),
  title: text("title"),
  createdByUserId: uuid("created_by_user_id"),
  createdByUserEmail: text("created_by_user_email"),
  lastUserId: uuid("last_user_id"),
  lastUserEmail: text("last_user_email"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable(
  "chat_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => chatSessions.id, { onDelete: "cascade" })
      .notNull(),
    role: messageRoleEnum("role").notNull(),
    body: text("body").notNull(),
    toolCallJson: jsonb("tool_call_json"),
    userId: uuid("user_id"),
    userEmail: text("user_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("chat_message_session_idx").on(t.sessionId, t.createdAt),
  }),
);

export const litItems = pgTable(
  "lit_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    type: litItemTypeEnum("type").notNull().default("paper"),
    title: text("title").notNull(),
    authorsJson: jsonb("authors_json").$type<string[]>(),
    abstract: text("abstract"),
    summary: text("summary"),
    url: text("url"),
    pdfUrl: text("pdf_url"),
    arxivId: text("arxiv_id"),
    doi: text("doi"),
    source: text("source"),
    sourceDetail: text("source_detail"),
    tagsJson: jsonb("tags_json").$type<string[]>(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
    workflowUpdatedAt: timestamp("workflow_updated_at", { withTimezone: true }),
    public: boolean("public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    externalUnique: uniqueIndex("lit_item_external_id_unique").on(t.externalId),
    recentIdx: index("lit_item_recent_idx").on(t.publishedAt, t.discoveredAt),
    typeIdx: index("lit_item_type_idx").on(t.type),
  }),
);

export const litItemAnalyses = pgTable(
  "lit_item_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    itemId: uuid("item_id")
      .references(() => litItems.id, { onDelete: "cascade" })
      .notNull(),
    analysisMd: text("analysis_md"),
    tldr: text("tldr"),
    threatLevel: text("threat_level"),
    readSignal: text("read_signal"),
    section: text("section"),
    aimTag: text("aim_tag"),
    sourcePath: text("source_path"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    externalUnique: uniqueIndex("lit_item_analysis_external_id_unique").on(t.externalId),
    itemIdx: index("lit_item_analysis_item_idx").on(t.itemId),
  }),
);

export const researchIdeas = pgTable(
  "research_idea",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    status: researchIdeaStatusEnum("status").notNull().default("seed"),
    shortSummary: text("short_summary"),
    expandedSummary: text("expanded_summary"),
    hypothesis: text("hypothesis"),
    motivation: text("motivation"),
    nextExperiments: text("next_experiments"),
    sourcePath: text("source_path"),
    public: boolean("public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    externalUnique: uniqueIndex("research_idea_external_id_unique").on(t.externalId),
    slugUnique: uniqueIndex("research_idea_slug_unique").on(t.slug),
    statusIdx: index("research_idea_status_idx").on(t.status, t.updatedAt),
  }),
);

export const researchIdeaClarifications = pgTable(
  "research_idea_clarification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .references(() => researchIdeas.id, { onDelete: "cascade" })
      .notNull(),
    body: text("body").notNull(),
    public: boolean("public").notNull().default(false),
    userId: uuid("user_id"),
    userEmail: text("user_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ideaIdx: index("research_idea_clarification_idea_idx").on(t.ideaId, t.createdAt),
  }),
);

export const litIdeaLinks = pgTable(
  "lit_idea_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .references(() => researchIdeas.id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id")
      .references(() => litItems.id, { onDelete: "cascade" })
      .notNull(),
    relationType: litRelationTypeEnum("relation_type").notNull().default("background"),
    confidence: real("confidence"),
    rationale: text("rationale"),
    status: litLinkStatusEnum("status").notNull().default("proposed"),
    source: litLinkSourceEnum("source").notNull().default("auto"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueLink: uniqueIndex("lit_idea_link_unique").on(t.ideaId, t.itemId, t.relationType),
    ideaIdx: index("lit_idea_link_idea_idx").on(t.ideaId, t.status),
    itemIdx: index("lit_idea_link_item_idx").on(t.itemId, t.status),
  }),
);

export const researchIdeaEvents = pgTable(
  "research_idea_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id"),
    ideaId: uuid("idea_id")
      .references(() => researchIdeas.id, { onDelete: "cascade" })
      .notNull(),
    eventType: text("event_type").notNull(),
    body: text("body").notNull(),
    public: boolean("public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    externalUnique: uniqueIndex("research_idea_event_external_id_unique").on(t.externalId),
    ideaIdx: index("research_idea_event_idea_idx").on(t.ideaId, t.createdAt),
  }),
);

export const litDigestRuns = pgTable(
  "lit_digest_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runDate: text("run_date").notNull(),
    status: text("status").notNull().default("imported"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    candidateCount: integer("candidate_count"),
    selectedCount: integer("selected_count"),
    logPath: text("log_path"),
    summaryMd: text("summary_md"),
    notificationStatus: text("notification_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    runDateUnique: uniqueIndex("lit_digest_run_date_unique").on(t.runDate),
    recentIdx: index("lit_digest_run_recent_idx").on(t.runDate),
  }),
);

export const litItemStates = pgTable(
  "lit_item_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .references(() => litItems.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").notNull(),
    userEmail: text("user_email"),
    readStatus: litReadStatusEnum("read_status").notNull().default("unread"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueState: uniqueIndex("lit_item_state_item_user_unique").on(t.itemId, t.userId),
    userIdx: index("lit_item_state_user_idx").on(t.userId, t.readStatus, t.updatedAt),
  }),
);

export const litItemDocuments = pgTable(
  "lit_item_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    itemId: uuid("item_id")
      .references(() => litItems.id, { onDelete: "cascade" })
      .notNull(),
    sourceUrl: text("source_url"),
    contentType: text("content_type"),
    status: text("status").notNull().default("fetched"),
    textMd: text("text_md"),
    textPlain: text("text_plain"),
    textSha256: text("text_sha256"),
    error: text("error"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    externalUnique: uniqueIndex("lit_item_document_external_id_unique").on(t.externalId),
    itemIdx: index("lit_item_document_item_idx").on(t.itemId, t.updatedAt),
  }),
);

export const litItemDocumentChunks = pgTable(
  "lit_item_document_chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => litItemDocuments.id, { onDelete: "cascade" })
      .notNull(),
    itemId: uuid("item_id")
      .references(() => litItems.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    documentChunkUnique: uniqueIndex("lit_item_document_chunk_unique").on(
      t.documentId,
      t.chunkIndex,
    ),
    itemIdx: index("lit_item_document_chunk_item_idx").on(t.itemId, t.chunkIndex),
  }),
);

export const litItemQuestions = pgTable(
  "lit_item_question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .references(() => litItems.id, { onDelete: "cascade" })
      .notNull(),
    question: text("question").notNull(),
    answerMd: text("answer_md"),
    citationsJson: jsonb("citations_json").$type<Array<Record<string, unknown>>>(),
    userId: uuid("user_id"),
    userEmail: text("user_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    itemIdx: index("lit_item_question_item_idx").on(t.itemId, t.createdAt),
    userIdx: index("lit_item_question_user_idx").on(t.userId, t.createdAt),
  }),
);

export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type Edge = typeof edges.$inferSelect;
export type Figure = typeof figures.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type AgentTask = typeof agentTasks.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type LitItem = typeof litItems.$inferSelect;
export type LitItemAnalysis = typeof litItemAnalyses.$inferSelect;
export type ResearchIdea = typeof researchIdeas.$inferSelect;
export type ResearchIdeaClarification = typeof researchIdeaClarifications.$inferSelect;
export type LitIdeaLink = typeof litIdeaLinks.$inferSelect;
export type ResearchIdeaEvent = typeof researchIdeaEvents.$inferSelect;
export type LitDigestRun = typeof litDigestRuns.$inferSelect;
export type LitItemState = typeof litItemStates.$inferSelect;
export type LitItemDocument = typeof litItemDocuments.$inferSelect;
export type LitItemDocumentChunk = typeof litItemDocumentChunks.$inferSelect;
export type LitItemQuestion = typeof litItemQuestions.$inferSelect;

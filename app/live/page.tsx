import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { claims, experiments, todos } from "@/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 10;

type BodyJson = { kind: "markdown"; text: string } | null;

type QueueItem = {
  id: string;
  kind: "todo" | "experiment" | "claim";
  title: string;
  githubIssueNumber: number | null;
  updatedAt: Date | string | null;
  status?: string | null;
  confidence?: "HIGH" | "MODERATE" | "LOW" | null;
  parent?: { id: string; title: string } | null;
  href?: string;
};

type Tone =
  | "todo"
  | "planning"
  | "review"
  | "flight"
  | "blocked"
  | "promotion"
  | "followup"
  | "useful"
  | "notUseful";

type Column = {
  key: string;
  label: string;
  help: string;
  tone: Tone;
  items: QueueItem[];
};

const IN_FLIGHT = new Set([
  "approved",
  "implementing",
  "code_reviewing",
  "running",
  "uploading",
  "interpreting",
  "reviewing",
]);

const TONE: Record<Tone, { accent: string; bg: string; dot: string; badge: string }> = {
  todo: {
    accent: "border-l-violet-500",
    bg: "bg-violet-50/80 dark:bg-violet-950/20",
    dot: "bg-violet-500",
    badge: "bg-violet-600 text-white",
  },
  planning: {
    accent: "border-l-sky-500",
    bg: "bg-sky-50/80 dark:bg-sky-950/20",
    dot: "bg-sky-500",
    badge: "bg-sky-600 text-white",
  },
  review: {
    accent: "border-l-amber-500",
    bg: "bg-amber-50/80 dark:bg-amber-950/20",
    dot: "bg-amber-500",
    badge: "bg-amber-500 text-black",
  },
  flight: {
    accent: "border-l-blue-600",
    bg: "bg-blue-50/80 dark:bg-blue-950/20",
    dot: "bg-blue-600",
    badge: "bg-blue-600 text-white",
  },
  blocked: {
    accent: "border-l-red-600",
    bg: "bg-red-50/80 dark:bg-red-950/20",
    dot: "bg-red-600",
    badge: "bg-red-600 text-white",
  },
  promotion: {
    accent: "border-l-fuchsia-500",
    bg: "bg-fuchsia-50/80 dark:bg-fuchsia-950/20",
    dot: "bg-fuchsia-500",
    badge: "bg-fuchsia-600 text-white",
  },
  followup: {
    accent: "border-l-cyan-500",
    bg: "bg-cyan-50/80 dark:bg-cyan-950/20",
    dot: "bg-cyan-500",
    badge: "bg-cyan-600 text-white",
  },
  useful: {
    accent: "border-l-emerald-600",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/20",
    dot: "bg-emerald-600",
    badge: "bg-emerald-600 text-white",
  },
  notUseful: {
    accent: "border-l-slate-500",
    bg: "bg-slate-100/90 dark:bg-slate-900/40",
    dot: "bg-slate-500",
    badge: "bg-slate-600 text-white",
  },
};

function bodyText(bodyJson: unknown): string {
  const body = bodyJson as BodyJson;
  return body?.text ?? "";
}

function relativeTime(when: Date | string | null): string {
  if (!when) return "";
  const d = typeof when === "string" ? new Date(when) : when;
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function isFollowupsRunning(item: {
  title: string;
  status?: string | null;
  podName?: string | null;
  body?: string;
}): boolean {
  if (!item.status || !IN_FLIGHT.has(item.status)) return false;
  if (item.podName === "followups_running") return true;
  const haystack = `${item.title}\n${item.body ?? ""}`.toLowerCase();
  return /\bfollow[- ]?ups?\b/.test(haystack);
}

function isUsefulCleanResult(item: {
  title: string;
  body: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
}): boolean {
  const haystack = `${item.title}\n${item.body}`.toLowerCase();
  if (/\bnot[- ]useful\b/.test(haystack)) return false;
  if (/\buseful\b/.test(haystack)) return true;
  return item.confidence !== "LOW";
}

export default async function LivePage() {
  const db = getDb();
  const [expRows, todoRows, claimRows] = await Promise.all([
    db
      .select({
        id: experiments.id,
        title: experiments.title,
        status: experiments.status,
        podName: experiments.podName,
        planJson: experiments.planJson,
        githubIssueNumber: experiments.githubIssueNumber,
        claimId: experiments.claimId,
        updatedAt: experiments.updatedAt,
      })
      .from(experiments)
      .orderBy(desc(experiments.updatedAt)),
    db
      .select({
        id: todos.id,
        text: todos.text,
        githubIssueNumber: todos.githubIssueNumber,
        createdAt: todos.createdAt,
      })
      .from(todos)
      .where(eq(todos.kind, "proposed"))
      .orderBy(desc(todos.createdAt)),
    db
      .select({
        id: claims.id,
        title: claims.title,
        confidence: claims.confidence,
        githubIssueNumber: claims.githubIssueNumber,
        bodyJson: claims.bodyJson,
        updatedAt: claims.updatedAt,
      })
      .from(claims)
      .where(eq(claims.status, "finalized"))
      .orderBy(desc(claims.updatedAt)),
  ]);

  const claimIds = Array.from(new Set(expRows.map((r) => r.claimId).filter(Boolean) as string[]));
  const parentClaims = claimIds.length
    ? await db
        .select({
          id: claims.id,
          title: claims.title,
        })
        .from(claims)
        .where(inArray(claims.id, claimIds))
    : [];
  const parentById = new Map(parentClaims.map((c) => [c.id, c]));

  const experimentItems = expRows.map((r) => ({
    id: r.id,
    kind: "experiment" as const,
    title: r.title,
    githubIssueNumber: r.githubIssueNumber,
    updatedAt: r.updatedAt,
    status: r.status,
    parent: r.claimId ? parentById.get(r.claimId) ?? null : null,
    podName: r.podName,
    body: bodyText(r.planJson),
  }));

  const followupItems = experimentItems.filter(isFollowupsRunning);
  const followupIds = new Set(followupItems.map((i) => i.id));

  const cleanResultItems = claimRows.map((r) => ({
    id: r.id,
    kind: "claim" as const,
    title: r.title,
    githubIssueNumber: r.githubIssueNumber,
    updatedAt: r.updatedAt,
    confidence: r.confidence,
    body: bodyText(r.bodyJson),
    href: `/claim/${r.id}`,
  }));

  const usefulResults = cleanResultItems.filter(isUsefulCleanResult);
  const notUsefulResults = cleanResultItems.filter((i) => !isUsefulCleanResult(i));

  const columns: Column[] = [
    {
      key: "todo",
      label: "Todo",
      help: "Queued issues ready to plan",
      tone: "todo",
      items: todoRows.map((r) => ({
        id: r.id,
        kind: "todo",
        title: r.text,
        githubIssueNumber: r.githubIssueNumber,
        updatedAt: r.createdAt,
        href: `/task/${r.id}`,
      })),
    },
    {
      key: "planning",
      label: "Planning",
      help: "Planner is drafting the plan",
      tone: "planning",
      items: experimentItems.filter((i) => i.status === "planning"),
    },
    {
      key: "plan_review",
      label: "Plan awaiting review",
      help: "Plan is ready for approval",
      tone: "review",
      items: experimentItems.filter((i) => i.status === "plan_pending"),
    },
    {
      key: "in_flight",
      label: "In flight",
      help: "Approved, implementing, running, or interpreting",
      tone: "flight",
      items: experimentItems.filter((i) => IN_FLIGHT.has(i.status ?? "") && !followupIds.has(i.id)),
    },
    {
      key: "blocked",
      label: "Blocked",
      help: "Needs intervention before it can move",
      tone: "blocked",
      items: experimentItems.filter((i) => i.status === "blocked"),
    },
    {
      key: "awaiting_promotion",
      label: "Awaiting promotion",
      help: "Passed review and ready to promote",
      tone: "promotion",
      items: experimentItems.filter((i) => i.status === "awaiting_promotion"),
    },
    {
      key: "followups_running",
      label: "Followups running",
      help: "Follow-up experiments currently active",
      tone: "followup",
      items: followupItems,
    },
    {
      key: "useful_results",
      label: "Useful results",
      help: "Clean results classified as useful",
      tone: "useful",
      items: usefulResults,
    },
    {
      key: "not_useful_results",
      label: "Not useful results",
      help: "Clean results classified as not useful",
      tone: "notUseful",
      items: notUsefulResults,
    },
  ];

  const total = columns.reduce((sum, col) => sum + col.items.length, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-baseline justify-between border-b border-border bg-panel px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Experiment queue</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            Todo, active work, blocked work, promotion candidates, and clean-result outcomes.
            No-status issues are hidden.
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted">
          {total} shown - {columns.length} panels
        </span>
      </header>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {columns.map((col) => (
          <QueueColumn key={col.key} column={col} />
        ))}
      </div>
    </div>
  );
}

function QueueColumn({ column }: { column: Column }) {
  const tone = TONE[column.tone];
  return (
    <div className="flex w-[276px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted">
            {column.label}
          </h2>
        </div>
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${tone.badge}`}>
          {column.items.length}
        </span>
      </div>
      <p className="mb-2 min-h-[28px] px-1 text-[10px] leading-snug text-muted/80">
        {column.help}
      </p>
      <ul className="flex flex-col gap-2">
        {column.items.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted/60">
            empty
          </li>
        ) : (
          column.items.map((item) => <QueueCard key={item.id} item={item} tone={tone} />)
        )}
      </ul>
    </div>
  );
}

function QueueCard({
  item,
  tone,
}: {
  item: QueueItem;
  tone: { accent: string; bg: string; badge: string };
}) {
  const ghHref =
    item.githubIssueNumber != null
      ? `https://github.com/superkaiba/explore-persona-space/issues/${item.githubIssueNumber}`
      : null;

  const title = item.href ? (
    <Link href={item.href} className="line-clamp-3 font-medium leading-snug hover:underline">
      {item.title}
    </Link>
  ) : (
    <div className="line-clamp-3 font-medium leading-snug">{item.title}</div>
  );

  return (
    <li
      className={`rounded-md border border-border border-l-4 p-2.5 text-[12px] shadow-card ${tone.accent} ${tone.bg}`}
    >
      {title}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted">
        <span className="font-mono">
          {item.githubIssueNumber != null ? `#${item.githubIssueNumber}` : ""}
        </span>
        <span>{relativeTime(item.updatedAt)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {item.status && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${tone.badge}`}>
            {item.status.replace(/_/g, " ")}
          </span>
        )}
        {item.confidence && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${tone.badge}`}>
            {item.confidence}
          </span>
        )}
      </div>
      {item.parent && (
        <div className="mt-1.5 truncate text-[10px] text-muted">
          <Link href={`/claim/${item.parent.id}`} className="hover:text-fg">
            parent: {item.parent.title}
          </Link>
        </div>
      )}
      {ghHref && (
        <a
          href={ghHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted hover:text-fg"
        >
          open <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </li>
  );
}

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { todos } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { TaskCreateForm } from "@/components/tasks/TaskCreateForm";
import { getEntityOptions } from "@/lib/entity-options";
import {
  displayIntentMode,
  displayPriority,
  displayTaskStatus,
  TASK_STATUS_ORDER,
  type TaskStatus,
} from "@/lib/tasks";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  text: string;
  status: string;
  kind: string;
  intentMode: string;
  intentSummary: string | null;
  usefulIf: string | null;
  priority: string;
  linkedKind: string | null;
  linkedId: string | null;
  githubIssueNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_TONE: Record<string, { dot: string; badge: string; row: string }> = {
  inbox: {
    dot: "bg-violet-500",
    badge: "bg-violet-600 text-white",
    row: "border-l-violet-500 bg-violet-50/80 dark:bg-violet-950/20",
  },
  scoped: {
    dot: "bg-sky-500",
    badge: "bg-sky-600 text-white",
    row: "border-l-sky-500 bg-sky-50/80 dark:bg-sky-950/20",
  },
  planning: {
    dot: "bg-amber-500",
    badge: "bg-amber-500 text-black",
    row: "border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/20",
  },
  running: {
    dot: "bg-blue-600",
    badge: "bg-blue-600 text-white",
    row: "border-l-blue-600 bg-blue-50/80 dark:bg-blue-950/20",
  },
  interpreting: {
    dot: "bg-cyan-500",
    badge: "bg-cyan-600 text-white",
    row: "border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/20",
  },
  awaiting_promotion: {
    dot: "bg-fuchsia-500",
    badge: "bg-fuchsia-600 text-white",
    row: "border-l-fuchsia-500 bg-fuchsia-50/80 dark:bg-fuchsia-950/20",
  },
  blocked: {
    dot: "bg-red-600",
    badge: "bg-red-600 text-white",
    row: "border-l-red-600 bg-red-50/80 dark:bg-red-950/20",
  },
  done: {
    dot: "bg-emerald-600",
    badge: "bg-emerald-600 text-white",
    row: "border-l-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/20",
  },
  cancelled: {
    dot: "bg-slate-500",
    badge: "bg-slate-600 text-white",
    row: "border-l-slate-500 bg-slate-100/90 dark:bg-slate-900/40",
  },
  archived: {
    dot: "bg-slate-500",
    badge: "bg-slate-600 text-white",
    row: "border-l-slate-500 bg-slate-100/90 dark:bg-slate-900/40",
  },
};

function groupStatus(status: string): TaskStatus {
  if (status === "open") return "inbox";
  if (status === "in_progress") return "running";
  return TASK_STATUS_ORDER.includes(status as TaskStatus) ? (status as TaskStatus) : "inbox";
}

function relativeTime(when: Date): string {
  const ms = Date.now() - when.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function Section({ status, rows }: { status: TaskStatus; rows: Row[] }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.inbox;
  return (
    <section className="mb-7">
      <header className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <h2 className="text-[12px] font-semibold tracking-tight">
          {displayTaskStatus(status)}
        </h2>
        <span className="font-mono text-[11px] text-muted">{rows.length}</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {rows.map((t) => (
          <TaskRow key={t.id} task={t} tone={tone} />
        ))}
      </ul>
    </section>
  );
}

export default async function TodosPage() {
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = (await db
    .select({
      id: todos.id,
      text: todos.text,
      status: todos.status,
      kind: todos.kind,
      intentMode: todos.intentMode,
      intentSummary: todos.intentSummary,
      usefulIf: todos.usefulIf,
      priority: todos.priority,
      linkedKind: todos.linkedKind,
      linkedId: todos.linkedId,
      githubIssueNumber: todos.githubIssueNumber,
      createdAt: todos.createdAt,
      updatedAt: todos.updatedAt,
    })
    .from(todos)
    .where(eq(todos.kind, "proposed"))
    .orderBy(desc(todos.updatedAt))) as Row[];
  const linkOptions = user ? await getEntityOptions() : [];

  const unlinked = rows.filter((t) => !t.linkedKind || !t.linkedId).length;
  const missingIntent = rows.filter((t) => !t.intentSummary && !t.usefulIf).length;
  const visibleStatuses = TASK_STATUS_ORDER.filter((status) =>
    rows.some((row) => groupStatus(row.status) === status),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-8">
      <header className="mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Research tasks</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
            Dashboard-native work items for exploratory questions, hypotheses,
            measurements, replications, and engineering tasks.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Stat label="total" value={rows.length} />
            <Stat label="unlinked" value={unlinked} />
            <Stat label="missing intent" value={missingIntent} />
          </div>
        </div>
      </header>

      <TaskCreateForm canCreate={!!user} linkOptions={linkOptions} />

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[13px] text-muted">
          No tasks yet.
        </p>
      ) : (
        visibleStatuses.map((status) => (
          <Section
            key={status}
            status={status}
            rows={rows.filter((row) => groupStatus(row.status) === status)}
          />
        ))
      )}
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

function TaskRow({
  task,
  tone,
}: {
  task: Row;
  tone: { badge: string; row: string };
}) {
  return (
    <li
      className={`rounded-md border border-border border-l-4 p-3 text-[13px] shadow-card ${tone.row}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/task/${task.id}`} className="line-clamp-2 font-medium leading-snug hover:underline">
            {task.text}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            <span className={`rounded px-1.5 py-0.5 font-semibold ${tone.badge}`}>
              {displayTaskStatus(task.status)}
            </span>
            <span className="rounded bg-panel/70 px-1.5 py-0.5 font-semibold text-fg">
              {displayIntentMode(task.intentMode)}
            </span>
            <span className="rounded bg-panel/70 px-1.5 py-0.5 font-semibold text-fg">
              {displayPriority(task.priority)}
            </span>
            <span>{task.linkedKind && task.linkedId ? `linked to ${task.linkedKind}` : "unlinked"}</span>
            <span>{relativeTime(task.updatedAt)}</span>
          </div>
        </div>
        {task.githubIssueNumber != null && (
          <a
            href={`https://github.com/superkaiba/explore-persona-space/issues/${task.githubIssueNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-muted hover:text-fg"
          >
            #{task.githubIssueNumber}
          </a>
        )}
      </div>
    </li>
  );
}

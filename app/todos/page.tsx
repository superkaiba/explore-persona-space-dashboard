import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { todos } from "@/db/schema";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  text: string;
  kind: string;
  githubIssueNumber: number | null;
  createdAt: Date;
};

const KIND_META: Record<
  string,
  { label: string; help: string; dot: string; bg: string }
> = {
  proposed: {
    label: "Proposed",
    help: "Has status:proposed — queued, ready to plan",
    dot: "bg-proposed",
    bg: "border-l-proposed",
  },
  untriaged: {
    label: "Untriaged",
    help: "Open issue with no status:* label",
    dot: "bg-untriaged",
    bg: "border-l-untriaged",
  },
};

function Section({ title, help, rows }: { title: string; help: string; rows: Row[] }) {
  return (
    <section className="mb-8">
      <header className="mb-2 flex items-baseline gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-[11px] text-muted">{rows.length}</span>
        <span className="text-[11px] text-muted">{help}</span>
      </header>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">Empty.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((t) => {
            const meta = KIND_META[t.kind] ?? KIND_META.proposed;
            return (
              <li
                key={t.id}
                className={`panel flex items-start gap-3 rounded-md border-l-4 p-2.5 text-[13px] ${meta.bg}`}
              >
                <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                <div className="flex-1 leading-snug">{t.text}</div>
                {t.githubIssueNumber != null && (
                  <a
                    href={`https://github.com/superkaiba/explore-persona-space/issues/${t.githubIssueNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-muted hover:text-fg"
                  >
                    #{t.githubIssueNumber}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function TodosPage() {
  const db = getDb();
  const rows = (await db
    .select({
      id: todos.id,
      text: todos.text,
      kind: todos.kind,
      githubIssueNumber: todos.githubIssueNumber,
      createdAt: todos.createdAt,
    })
    .from(todos)
    .orderBy(desc(todos.createdAt))) as Row[];

  const proposed = rows.filter((t) => t.kind === "proposed");
  const untriaged = rows.filter((t) => t.kind === "untriaged");

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Open work</h1>
        <p className="mt-1 text-[13px] text-muted">
          Issues from the research repo, split by triage state. Proposed = ready to plan.
          Untriaged = needs a status label.
        </p>
      </header>
      <Section title={KIND_META.proposed.label} help={KIND_META.proposed.help} rows={proposed} />
      <Section title={KIND_META.untriaged.label} help={KIND_META.untriaged.help} rows={untriaged} />
    </div>
  );
}

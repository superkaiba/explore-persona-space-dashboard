import Link from "next/link";

export type FeedItem = {
  id: string;
  kind: "claim" | "experiment" | "proposed" | "untriaged";
  title: string;
  confidence?: "HIGH" | "MODERATE" | "LOW" | null;
  status?: string | null;
  githubIssueNumber: number | null;
  timestamp: Date | string;
  detailHref?: string;
  verb: string;
};

const KIND_DOT: Record<FeedItem["kind"], string> = {
  claim: "bg-confidence-low",
  experiment: "bg-running",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
};

const KIND_LABEL: Record<FeedItem["kind"], string> = {
  claim: "claim",
  experiment: "experiment",
  proposed: "proposed",
  untriaged: "untriaged",
};

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function fmtTime(v: Date | string): string {
  return asDate(v).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDay(v: Date | string): string {
  return asDate(v).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = asDate(a);
  const db = asDate(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function ActivityFeed({
  items,
  emptyText,
  groupByDay = false,
}: {
  items: FeedItem[];
  emptyText: string;
  groupByDay?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-[13px] text-muted">{emptyText}</p>;
  }

  if (!groupByDay) {
    return (
      <ul className="flex flex-col">
        {items.map((it) => (
          <Row key={it.id} item={it} />
        ))}
      </ul>
    );
  }

  // Group by day
  const groups: { day: Date; items: FeedItem[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.day, it.timestamp)) last.items.push(it);
    else groups.push({ day: it.timestamp, items: [it] });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={asDate(g.day).toISOString()}>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            {fmtDay(g.day)}
          </h2>
          <ul className="flex flex-col">
            {g.items.map((it) => (
              <Row key={it.id} item={it} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ item }: { item: FeedItem }) {
  const inner = (
    <div className="group flex items-start gap-3 border-b border-border py-2 pr-2 transition-colors hover:bg-subtle">
      <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[item.kind]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 text-[10px] font-medium uppercase tracking-wider text-muted">
          <span>{KIND_LABEL[item.kind]}</span>
          <span>{item.verb}</span>
          {item.kind === "claim" && item.confidence && (
            <span className="rounded bg-subtle px-1 py-0.5 text-[9px] font-bold normal-case tracking-normal text-fg">
              {item.confidence}
            </span>
          )}
          {item.kind === "experiment" && item.status && (
            <span className="rounded bg-running/15 px-1 py-0.5 text-[9px] font-medium normal-case tracking-normal text-running">
              {item.status.replace(/_/g, " ")}
            </span>
          )}
          <span className="ml-auto font-mono normal-case tracking-normal text-muted">
            {fmtTime(item.timestamp)}
          </span>
        </div>
        <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug">{item.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
          {item.githubIssueNumber != null && (
            <a
              href={`https://github.com/superkaiba/explore-persona-space/issues/${item.githubIssueNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-fg"
              onClick={(e) => e.stopPropagation()}
            >
              #{item.githubIssueNumber} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <li>
      {item.detailHref ? <Link href={item.detailHref}>{inner}</Link> : inner}
    </li>
  );
}

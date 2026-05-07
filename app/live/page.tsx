import Link from "next/link";
import { desc, isNotNull } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { experiments, claims } from "@/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 10;

const COLUMN_ORDER: Array<{ key: string; label: string; help: string }> = [
  { key: "planning", label: "Planning", help: "/issue running adversarial-planner" },
  { key: "plan_pending", label: "Plan pending", help: "Awaiting your approval" },
  { key: "approved", label: "Approved", help: "Plan approved, queued to dispatch" },
  { key: "implementing", label: "Implementing", help: "Writing experiment code" },
  { key: "code_reviewing", label: "Code review", help: "Adversarial review of the diff" },
  { key: "running", label: "Running", help: "Training / eval on a pod" },
  { key: "uploading", label: "Uploading", help: "Pushing artifacts to WandB / HF" },
  { key: "interpreting", label: "Interpreting", help: "Analyzer drafting clean result" },
  { key: "reviewing", label: "Reviewing", help: "Final adversarial review" },
  {
    key: "awaiting_promotion",
    label: "Awaiting promotion",
    help: "Reviewer PASS — ready to promote",
  },
];

function statusColor(status: string): string {
  if (["running", "uploading"].includes(status)) return "border-l-running";
  if (["interpreting", "reviewing", "awaiting_promotion"].includes(status))
    return "border-l-confidence-moderate";
  if (["planning", "plan_pending", "approved"].includes(status))
    return "border-l-proposed";
  return "border-l-confidence-low";
}

function relativeTime(when: Date | string | null): string {
  if (!when) return "—";
  const d = typeof when === "string" ? new Date(when) : when;
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default async function LivePage() {
  const db = getDb();
  const rows = await db
    .select({
      id: experiments.id,
      title: experiments.title,
      status: experiments.status,
      githubIssueNumber: experiments.githubIssueNumber,
      claimId: experiments.claimId,
      updatedAt: experiments.updatedAt,
    })
    .from(experiments)
    .where(isNotNull(experiments.status))
    .orderBy(desc(experiments.updatedAt));

  const claimIds = Array.from(new Set(rows.map((r) => r.claimId).filter(Boolean) as string[]));
  const parentClaims = claimIds.length
    ? await db
        .select({
          id: claims.id,
          title: claims.title,
          githubIssueNumber: claims.githubIssueNumber,
        })
        .from(claims)
    : [];
  const parentById = new Map(parentClaims.map((c) => [c.id, c]));

  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    (grouped[r.status] ??= []).push(r);
  }
  const totalActive = rows.length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-baseline justify-between border-b border-border bg-panel px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Live</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            In-progress experiments by GitHub status. Refreshes on visit.
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted">
          {totalActive} active · {COLUMN_ORDER.length} stages
        </span>
      </header>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {COLUMN_ORDER.map((col) => {
          const items = grouped[col.key] ?? [];
          return (
            <div key={col.key} className="flex w-[260px] shrink-0 flex-col">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {col.label}
                </h2>
                <span className="font-mono text-[10px] text-muted">{items.length}</span>
              </div>
              <p className="mb-2 px-1 text-[10px] text-muted/80">{col.help}</p>
              <ul className="flex flex-col gap-2">
                {items.length === 0 ? (
                  <li className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted/60">
                    empty
                  </li>
                ) : (
                  items.map((r) => {
                    const parent = r.claimId ? parentById.get(r.claimId) : null;
                    return (
                      <li
                        key={r.id}
                        className={`panel rounded-md border-l-4 p-2.5 text-[12px] ${statusColor(r.status)}`}
                      >
                        <div className="line-clamp-3 font-medium leading-snug">{r.title}</div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
                          <span className="font-mono">
                            {r.githubIssueNumber != null ? `#${r.githubIssueNumber}` : ""}
                          </span>
                          <span>{relativeTime(r.updatedAt)}</span>
                        </div>
                        {parent && (
                          <div className="mt-1.5 truncate text-[10px] text-muted">
                            <Link href={`/claim/${parent.id}`} className="hover:text-fg">
                              ↳ {parent.title}
                            </Link>
                          </div>
                        )}
                        {r.githubIssueNumber != null && (
                          <a
                            href={`https://github.com/superkaiba/explore-persona-space/issues/${r.githubIssueNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted hover:text-fg"
                          >
                            open <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

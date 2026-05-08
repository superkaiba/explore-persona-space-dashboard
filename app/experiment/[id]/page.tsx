import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { claims, experiments, runs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { EntityComments } from "@/components/discussion/EntityComments";
import { EntityLinkManager } from "@/components/entity/EntityLinkManager";
import { RelatedEntitiesList } from "@/components/entity/RelatedEntitiesList";
import { getEntityOptions } from "@/lib/entity-options";
import { getRelatedEntities } from "@/lib/related-entities";

export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;

function fmtDate(d: Date | null): string {
  if (!d) return "No date";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusBadgeClass(status: string | null): string {
  if (!status) return "bg-subtle text-fg";
  if (status === "planning") return "bg-sky-600 text-white";
  if (status === "plan_pending") return "bg-amber-500 text-black";
  if (status === "blocked") return "bg-red-600 text-white";
  if (status === "awaiting_promotion") return "bg-fuchsia-600 text-white";
  if (["running", "uploading", "implementing", "code_reviewing"].includes(status)) {
    return "bg-blue-600 text-white";
  }
  if (["interpreting", "reviewing"].includes(status)) return "bg-cyan-600 text-white";
  return "bg-slate-600 text-white";
}

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [experiment] = await db.select().from(experiments).where(eq(experiments.id, id)).limit(1);
  if (!experiment) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = !!user;

  const [claim, runRows, related, linkOptions] = await Promise.all([
    experiment.claimId
      ? db.select().from(claims).where(eq(claims.id, experiment.claimId)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db.select().from(runs).where(eq(runs.experimentId, experiment.id)),
    getRelatedEntities("experiment", experiment.id, { includePrivate: canEdit }),
    canEdit ? getEntityOptions() : Promise.resolve([]),
  ]);

  const plan = experiment.planJson as BodyJson;
  const planText = plan?.text ?? "";

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_340px] gap-8 px-8 py-8">
        <main className="min-w-0">
          <Link
            href="/graph"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3 w-3" />
            graph
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-running" />
            <span>Experiment</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] ${statusBadgeClass(experiment.status)}`}>
              {experiment.status.replace(/_/g, " ")}
            </span>
            {experiment.githubIssueNumber != null && (
              <a
                href={`https://github.com/superkaiba/explore-persona-space/issues/${experiment.githubIssueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                #{experiment.githubIssueNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
            {experiment.title}
          </h1>

          {experiment.hypothesis && (
            <section className="mt-6 rounded-lg border border-border bg-panel p-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Hypothesis
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">
                {experiment.hypothesis}
              </p>
            </section>
          )}

          {planText && (
            <section className="mt-6">
              <h2 className="mb-2 text-[13px] font-semibold tracking-tight">Plan</h2>
              <div className="prose prose-sm prose-tight max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{planText}</ReactMarkdown>
              </div>
            </section>
          )}

          <section className="mt-8 border-t border-border pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold tracking-tight">Workspace links</h2>
              {canEdit && (
                <EntityLinkManager
                  fromKind="experiment"
                  fromId={experiment.id}
                  options={linkOptions}
                  compact
                />
              )}
            </div>
            <RelatedEntitiesList items={related} />
          </section>

          <section className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Notes</h2>
            <EntityComments entityKind="experiment" entityId={experiment.id} canPost={canEdit} />
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="text-[12px] font-semibold tracking-tight">State</h2>
            <div className="mt-3 divide-y divide-border text-[12px]">
              <Meta label="Status" value={experiment.status.replace(/_/g, " ")} />
              <Meta label="Pod" value={experiment.podName ?? "Not set"} />
              <Meta label="Created" value={fmtDate(experiment.createdAt)} />
              <Meta label="Updated" value={fmtDate(experiment.updatedAt)} />
            </div>
          </section>

          {claim && (
            <section className="rounded-lg border border-border bg-panel p-4">
              <h2 className="text-[12px] font-semibold tracking-tight">Primary claim</h2>
              <Link href={`/claim/${claim.id}`} className="mt-2 block text-[13px] font-medium hover:underline">
                {claim.title}
              </Link>
            </section>
          )}

          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="mb-3 text-[12px] font-semibold tracking-tight">Runs</h2>
            <div className="flex flex-col gap-2">
              {runRows.map((run) => (
                <Link
                  key={run.id}
                  href={`/run/${run.id}`}
                  className="rounded-md border border-border bg-canvas p-2.5 hover:bg-subtle"
                >
                  <div className="text-[12px] font-medium">
                    {run.wandbUrl ?? run.hfUrl ?? `Run ${run.seed ?? run.id.slice(0, 8)}`}
                  </div>
                  <div className="mt-1 text-[10px] text-muted">
                    {run.completedAt ? "completed" : run.startedAt ? "running" : "created"}
                  </div>
                </Link>
              ))}
              {runRows.length === 0 && <p className="text-[12px] text-muted">No runs yet.</p>}
            </div>
          </section>
        </aside>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="text-right font-mono text-[11px] text-fg">{value}</span>
    </div>
  );
}

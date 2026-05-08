import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { experiments, runs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { EntityComments } from "@/components/discussion/EntityComments";
import { EntityLinkManager } from "@/components/entity/EntityLinkManager";
import { RelatedEntitiesList } from "@/components/entity/RelatedEntitiesList";
import { getEntityOptions } from "@/lib/entity-options";
import { getRelatedEntities } from "@/lib/related-entities";

export const dynamic = "force-dynamic";

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

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!run) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = !!user;

  const [experiment, related, linkOptions] = await Promise.all([
    db.select().from(experiments).where(eq(experiments.id, run.experimentId)).limit(1).then((rows) => rows[0] ?? null),
    getRelatedEntities("run", run.id, { includePrivate: canEdit }),
    canEdit ? getEntityOptions() : Promise.resolve([]),
  ]);

  const title = run.wandbUrl ?? run.hfUrl ?? `Run ${run.seed ?? run.id.slice(0, 8)}`;

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_320px] gap-8 px-8 py-8">
        <main className="min-w-0">
          <Link
            href={experiment ? `/experiment/${experiment.id}` : "/graph"}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3 w-3" />
            {experiment ? "experiment" : "graph"}
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-600" />
            <span>Run</span>
            <span className="rounded bg-subtle px-1.5 py-0.5 text-[9px] text-fg">
              {run.completedAt ? "completed" : run.startedAt ? "running" : "created"}
            </span>
            {run.wandbUrl && (
              <a
                href={run.wandbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                wandb
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {run.hfUrl && (
              <a
                href={run.hfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                hf
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
            {title}
          </h1>

          {run.configYaml && (
            <section className="mt-6">
              <h2 className="mb-2 text-[13px] font-semibold tracking-tight">Config</h2>
              <pre className="max-h-[520px] overflow-auto rounded-lg border border-border bg-panel p-4 text-[12px] leading-relaxed">
                {run.configYaml}
              </pre>
            </section>
          )}

          {run.metricsJson != null && (
            <section className="mt-6">
              <h2 className="mb-2 text-[13px] font-semibold tracking-tight">Metrics</h2>
              <pre className="max-h-[520px] overflow-auto rounded-lg border border-border bg-panel p-4 text-[12px] leading-relaxed">
                {JSON.stringify(run.metricsJson, null, 2)}
              </pre>
            </section>
          )}

          <section className="mt-8 border-t border-border pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold tracking-tight">Workspace links</h2>
              {canEdit && (
                <EntityLinkManager fromKind="run" fromId={run.id} options={linkOptions} compact />
              )}
            </div>
            <RelatedEntitiesList items={related} />
          </section>

          <section className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Notes</h2>
            <EntityComments entityKind="run" entityId={run.id} canPost={canEdit} />
          </section>
        </main>

        <aside className="space-y-4">
          {experiment && (
            <section className="rounded-lg border border-border bg-panel p-4">
              <h2 className="text-[12px] font-semibold tracking-tight">Experiment</h2>
              <Link href={`/experiment/${experiment.id}`} className="mt-2 block text-[13px] font-medium hover:underline">
                {experiment.title}
              </Link>
            </section>
          )}
          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="text-[12px] font-semibold tracking-tight">Timing</h2>
            <div className="mt-3 divide-y divide-border text-[12px]">
              <Meta label="Created" value={fmtDate(run.createdAt)} />
              <Meta label="Started" value={fmtDate(run.startedAt)} />
              <Meta label="Completed" value={fmtDate(run.completedAt)} />
              <Meta label="Seed" value={run.seed == null ? "Not set" : String(run.seed)} />
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

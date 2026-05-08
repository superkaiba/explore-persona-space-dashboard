import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { getDb } from "@/db/client";
import { projects } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { EntityComments } from "@/components/discussion/EntityComments";
import { EntityLinkManager } from "@/components/entity/EntityLinkManager";
import { RelatedEntitiesList } from "@/components/entity/RelatedEntitiesList";
import { getEntityOptions } from "@/lib/entity-options";
import { getRelatedEntities } from "@/lib/related-entities";
import { formatLitDate } from "@/lib/lit";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = !!user;

  const [project] = await db
    .select()
    .from(projects)
    .where(user ? eq(projects.slug, slug) : eq(projects.slug, slug))
    .limit(1);
  if (!project || (!project.public && !user)) notFound();

  const [related, linkOptions] = await Promise.all([
    getRelatedEntities("project", project.id, { includePrivate: canEdit }),
    canEdit ? getEntityOptions() : Promise.resolve([]),
  ]);

  const byKind = {
    claims: related.filter((item) => item.kind === "claim"),
    experiments: related.filter((item) => item.kind === "experiment"),
    runs: related.filter((item) => item.kind === "run"),
    tasks: related.filter((item) => item.kind === "todo"),
    ideas: related.filter((item) => item.kind === "research_idea"),
    literature: related.filter((item) => item.kind === "lit_item"),
  };

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_320px] gap-8 px-8 py-8">
        <main className="min-w-0">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3 w-3" />
            projects
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Project</span>
            <span className="rounded bg-subtle px-1.5 py-0.5 text-[9px] text-fg">
              {project.status}
            </span>
            <span>{project.public ? "public" : "private"}</span>
          </div>

          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
            {project.title}
          </h1>
          {project.summary && (
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted">
              {project.summary}
            </p>
          )}

          <section className="mt-8 border-t border-border pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold tracking-tight">Workspace links</h2>
              {canEdit && (
                <EntityLinkManager
                  fromKind="project"
                  fromId={project.id}
                  options={linkOptions}
                  compact
                />
              )}
            </div>
            <RelatedEntitiesList items={related} />
          </section>

          <section className="mt-8 border-t border-border pt-6">
            <h2 className="mb-3 text-[13px] font-semibold tracking-tight">Notes</h2>
            <EntityComments entityKind="project" entityId={project.id} canPost={canEdit} />
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="text-[12px] font-semibold tracking-tight">Coverage</h2>
            <div className="mt-3 divide-y divide-border text-[12px]">
              <Meta label="Claims" value={byKind.claims.length} />
              <Meta label="Experiments" value={byKind.experiments.length} />
              <Meta label="Runs" value={byKind.runs.length} />
              <Meta label="Tasks" value={byKind.tasks.length} />
              <Meta label="Ideas" value={byKind.ideas.length} />
              <Meta label="Literature" value={byKind.literature.length} />
            </div>
          </section>
          <section className="rounded-lg border border-border bg-panel p-4">
            <h2 className="text-[12px] font-semibold tracking-tight">Timeline</h2>
            <div className="mt-3 divide-y divide-border text-[12px]">
              <Meta label="Created" value={formatLitDate(project.createdAt)} />
              <Meta label="Updated" value={formatLitDate(project.updatedAt)} />
            </div>
          </section>
        </aside>
      </article>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-[11px] text-fg">{value}</span>
    </div>
  );
}

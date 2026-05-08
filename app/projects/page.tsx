import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { FolderKanban } from "lucide-react";
import { getDb } from "@/db/client";
import { projects } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";
import { formatLitDate } from "@/lib/lit";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const db = getDb();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = await db
    .select()
    .from(projects)
    .where(user ? undefined : eq(projects.public, true))
    .orderBy(desc(projects.updatedAt))
    .limit(100);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-muted">
              <FolderKanban className="h-4 w-4" />
              Project workspace
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
              Durable containers for claims, experiments, runs, literature, ideas, and tasks.
            </p>
          </div>
          <ProjectCreateForm canCreate={!!user} />
        </header>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-center text-[13px] text-muted">
            No projects yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="rounded-lg border border-border bg-panel p-4 shadow-card hover:bg-subtle/70"
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                  <span className="rounded bg-canvas px-1.5 py-0.5 font-medium text-fg">
                    {project.status}
                  </span>
                  <span>{project.public ? "public" : "private"}</span>
                  <span>{formatLitDate(project.updatedAt)}</span>
                </div>
                <h2 className="text-[15px] font-semibold leading-snug">{project.title}</h2>
                {project.summary && (
                  <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted">
                    {project.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

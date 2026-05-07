import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb } from "@/db/client";
import { claims, edges, experiments, figures, todos } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { EditableTitle } from "@/components/editor/EditableTitle";
import { EditableBody } from "@/components/editor/EditableBody";
import { EdgeManager } from "@/components/editor/EdgeManager";
import { ClaimDiscussion } from "@/components/discussion/ClaimDiscussion";

export const dynamic = "force-dynamic";

type BodyJson = { kind: "markdown"; text: string } | null;
type Confidence = "HIGH" | "MODERATE" | "LOW" | null;

const CONF_BADGE: Record<NonNullable<Confidence>, string> = {
  HIGH: "bg-confidence-high text-white",
  MODERATE: "bg-confidence-moderate text-black",
  LOW: "bg-confidence-low text-white",
};

const CONF_DOT: Record<NonNullable<Confidence>, string> = {
  HIGH: "bg-confidence-high",
  MODERATE: "bg-confidence-moderate",
  LOW: "bg-confidence-low",
};

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [claim] = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  if (!claim) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = !!user;

  // All-claims option list for the EdgeManager (loaded only if editable)
  const allClaimOptions = canEdit
    ? await db
        .select({
          id: claims.id,
          title: claims.title,
          confidence: claims.confidence,
          githubIssueNumber: claims.githubIssueNumber,
        })
        .from(claims)
    : [];

  // Hero figure
  let hero: { url: string; caption: string | null } | null = null;
  if (claim.heroFigureId) {
    const [fig] = await db
      .select({ url: figures.url, caption: figures.caption })
      .from(figures)
      .where(eq(figures.id, claim.heroFigureId))
      .limit(1);
    if (fig) hero = fig;
  }

  // All edges touching this claim
  const incoming = await db
    .select()
    .from(edges)
    .where(and(eq(edges.toKind, "claim"), eq(edges.toId, id)));
  const outgoing = await db
    .select()
    .from(edges)
    .where(and(eq(edges.fromKind, "claim"), eq(edges.fromId, id)));

  const claimsToFetch = new Set<string>();
  const expsToFetch = new Set<string>();
  const todosToFetch = new Set<string>();
  for (const e of incoming) {
    if (e.fromKind === "claim") claimsToFetch.add(e.fromId);
    if (e.fromKind === "experiment") expsToFetch.add(e.fromId);
    if (e.fromKind === "todo") todosToFetch.add(e.fromId);
  }
  for (const e of outgoing) {
    if (e.toKind === "claim") claimsToFetch.add(e.toId);
    if (e.toKind === "experiment") expsToFetch.add(e.toId);
    if (e.toKind === "todo") todosToFetch.add(e.toId);
  }

  const [linkedClaims, linkedExps, linkedTodos] = await Promise.all([
    claimsToFetch.size > 0
      ? db.select({
          id: claims.id,
          title: claims.title,
          confidence: claims.confidence,
          githubIssueNumber: claims.githubIssueNumber,
        }).from(claims).where(inArray(claims.id, [...claimsToFetch]))
      : Promise.resolve([] as { id: string; title: string; confidence: Confidence; githubIssueNumber: number | null }[]),
    expsToFetch.size > 0
      ? db.select({
          id: experiments.id,
          title: experiments.title,
          status: experiments.status,
          githubIssueNumber: experiments.githubIssueNumber,
        }).from(experiments).where(inArray(experiments.id, [...expsToFetch]))
      : Promise.resolve([] as { id: string; title: string; status: string | null; githubIssueNumber: number | null }[]),
    todosToFetch.size > 0
      ? db.select({
          id: todos.id,
          text: todos.text,
          kind: todos.kind,
          githubIssueNumber: todos.githubIssueNumber,
        }).from(todos).where(inArray(todos.id, [...todosToFetch]))
      : Promise.resolve([] as { id: string; text: string; kind: string; githubIssueNumber: number | null }[]),
  ]);

  // Bucket by direction
  const claimById = new Map(linkedClaims.map((c) => [c.id, c]));
  const expById = new Map(linkedExps.map((e) => [e.id, e]));
  const todoById = new Map(linkedTodos.map((t) => [t.id, t]));

  const derivesFrom = outgoing
    .filter((e) => e.toKind === "claim" && e.type === "derives_from")
    .map((e) => claimById.get(e.toId))
    .filter(Boolean) as { id: string; title: string; confidence: Confidence; githubIssueNumber: number | null }[];
  const derivedBy = incoming
    .filter((e) => e.fromKind === "claim" && e.type === "derives_from")
    .map((e) => claimById.get(e.fromId))
    .filter(Boolean) as typeof derivesFrom;
  const linkedExperiments = incoming
    .filter((e) => e.fromKind === "experiment")
    .map((e) => expById.get(e.fromId))
    .filter(Boolean) as { id: string; title: string; status: string | null; githubIssueNumber: number | null }[];
  const linkedTodosList = incoming
    .filter((e) => e.fromKind === "todo")
    .map((e) => todoById.get(e.fromId))
    .filter(Boolean) as { id: string; text: string; kind: string; githubIssueNumber: number | null }[];

  const body = claim.bodyJson as BodyJson;
  const markdown = body?.text ?? "";

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-6xl grid-cols-[1fr_280px] gap-10 px-8 py-8">
        <div className="min-w-0">
          <Link
            href="/graph"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3 w-3" />
            graph
          </Link>

          <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${claim.confidence ? CONF_DOT[claim.confidence] : "bg-confidence-low"}`} />
            <span>Claim</span>
            {claim.confidence && (
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${CONF_BADGE[claim.confidence]}`}>
                {claim.confidence}
              </span>
            )}
            {claim.githubIssueNumber != null && (
              <a
                href={`https://github.com/superkaiba/explore-persona-space/issues/${claim.githubIssueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                #{claim.githubIssueNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <EditableTitle claimId={claim.id} initialTitle={claim.title} canEdit={canEdit} />

          {hero && (
            <figure className="mt-6 overflow-hidden rounded-lg border border-border bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.url} alt={hero.caption ?? "Hero figure"} className="w-full" />
              {hero.caption && (
                <figcaption className="border-t border-border bg-subtle px-4 py-2 text-[12px] text-muted">
                  {hero.caption}
                </figcaption>
              )}
            </figure>
          )}

          <EditableBody claimId={claim.id} initialBody={markdown} canEdit={canEdit} />

          <ClaimDiscussion
            claimId={claim.id}
            claimTitle={claim.title}
            canPost={canEdit}
          />
        </div>

        <aside className="space-y-6 text-[12.5px]">
          {derivesFrom.length > 0 && (
            <Group title="Derives from" help="Older claims this builds on">
              {derivesFrom.map((c) => (
                <ClaimRow key={c.id} c={c} />
              ))}
            </Group>
          )}
          {derivedBy.length > 0 && (
            <Group title="Derived by" help="Newer claims that supersede or extend this">
              {derivedBy.map((c) => (
                <ClaimRow key={c.id} c={c} />
              ))}
            </Group>
          )}
          {linkedExperiments.length > 0 && (
            <Group title="Active experiments" help="In-progress work that points here">
              {linkedExperiments.map((e) => (
                <ExperimentRow key={e.id} e={e} />
              ))}
            </Group>
          )}
          {linkedTodosList.length > 0 && (
            <Group title="Open work" help="Proposed / untriaged issues that reference this claim">
              {linkedTodosList.map((t) => (
                <TodoRow key={t.id} t={t} />
              ))}
            </Group>
          )}
          {derivesFrom.length === 0 &&
            derivedBy.length === 0 &&
            linkedExperiments.length === 0 &&
            linkedTodosList.length === 0 && (
              <p className="text-muted">No linked entities.</p>
            )}

          {canEdit && <EdgeManager
            fromClaimId={claim.id}
            allClaims={allClaimOptions}
            alreadyLinkedIds={
              new Set([
                ...derivesFrom.map((c) => c.id),
                ...derivedBy.map((c) => c.id),
              ])
            }
          />}
        </aside>
      </article>
    </div>
  );
}

function Group({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted">{help}</p>
      </header>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

function ClaimRow({
  c,
}: {
  c: { id: string; title: string; confidence: Confidence; githubIssueNumber: number | null };
}) {
  return (
    <li>
      <Link
        href={`/claim/${c.id}`}
        className="panel flex items-start gap-2 rounded-md border-l-4 p-2 transition-colors hover:bg-subtle"
        style={{
          borderLeftColor: c.confidence === "HIGH"
            ? "#16a34a"
            : c.confidence === "MODERATE"
              ? "#eab308"
              : "#9ca3af",
        }}
      >
        <div className="flex-1 leading-snug">{c.title}</div>
        {c.githubIssueNumber != null && (
          <span className="font-mono text-[10px] text-muted">#{c.githubIssueNumber}</span>
        )}
      </Link>
    </li>
  );
}

function ExperimentRow({
  e,
}: {
  e: { id: string; title: string; status: string | null; githubIssueNumber: number | null };
}) {
  return (
    <li>
      <a
        href={
          e.githubIssueNumber != null
            ? `https://github.com/superkaiba/explore-persona-space/issues/${e.githubIssueNumber}`
            : "#"
        }
        target="_blank"
        rel="noopener noreferrer"
        className="panel block rounded-md border-l-4 border-l-running p-2 transition-colors hover:bg-subtle"
      >
        <div className="flex items-center gap-2">
          {e.status && (
            <span className="rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium text-running">
              {e.status.replace(/_/g, " ")}
            </span>
          )}
          {e.githubIssueNumber != null && (
            <span className="ml-auto font-mono text-[10px] text-muted">#{e.githubIssueNumber}</span>
          )}
        </div>
        <div className="mt-1 line-clamp-2 leading-snug">{e.title}</div>
      </a>
    </li>
  );
}

function TodoRow({
  t,
}: {
  t: { id: string; text: string; kind: string; githubIssueNumber: number | null };
}) {
  return (
    <li>
      <a
        href={
          t.githubIssueNumber != null
            ? `https://github.com/superkaiba/explore-persona-space/issues/${t.githubIssueNumber}`
            : "#"
        }
        target="_blank"
        rel="noopener noreferrer"
        className={`panel flex items-start gap-2 rounded-md border-l-4 p-2 transition-colors hover:bg-subtle ${
          t.kind === "untriaged" ? "border-l-untriaged" : "border-l-proposed"
        }`}
      >
        <span
          className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            t.kind === "untriaged" ? "bg-untriaged" : "bg-proposed"
          }`}
        />
        <div className="flex-1 leading-snug">{t.text}</div>
      </a>
    </li>
  );
}

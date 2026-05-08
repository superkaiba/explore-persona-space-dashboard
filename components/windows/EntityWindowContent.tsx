"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Maximize2, Sparkles } from "lucide-react";
import type { WindowKind } from "./WindowProvider";
import { ClaimChatTab } from "./ClaimChatTab";
import { IssueRef, linkifyIssueRefs } from "@/components/IssueRef";

type Confidence = "HIGH" | "MODERATE" | "LOW" | null;

type EntityFull = {
  id: string;
  kind: WindowKind;
  title: string;
  body: string;
  confidence?: Confidence;
  status?: string;
  slug?: string;
  url?: string | null;
  githubIssueNumber: number | null;
  hero: { url: string; caption: string | null } | null;
};

const CONF_BADGE: Record<NonNullable<Confidence>, string> = {
  HIGH: "bg-confidence-high text-white",
  MODERATE: "bg-confidence-moderate text-black",
  LOW: "bg-confidence-low text-white",
};

const KIND_LABEL: Record<WindowKind, string> = {
  project: "Project",
  claim: "Claim",
  experiment: "In progress",
  run: "Run",
  proposed: "Task",
  untriaged: "Untriaged",
  research_idea: "Research idea",
  lit_item: "Literature",
};

const KIND_COLOR: Record<WindowKind, string> = {
  project: "bg-fg",
  claim: "bg-confidence-low",
  experiment: "bg-running",
  run: "bg-cyan-600",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
  research_idea: "bg-amber-500",
  lit_item: "bg-emerald-600",
};

function statusBadgeClass(status: string | undefined): string {
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

export function EntityWindowContent({
  kind,
  id,
  currentUserEmail,
}: {
  kind: WindowKind;
  id: string;
  currentUserEmail: string | null;
}) {
  const [entity, setEntity] = useState<EntityFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/entity/${kind}/${id}/full`);
      if (!r.ok) {
        if (!cancelled) setError(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as EntityFull;
      if (!cancelled) setEntity(j);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  if (error)
    return (
      <div className="p-4 text-[13px] text-red-600">Failed to load: {error}</div>
    );
  if (!entity)
    return <div className="p-4 text-[12px] text-muted">Loading…</div>;

  const isClaim = entity.kind === "claim";
  const fullPageHref = isClaim
    ? `/claim/${entity.id}`
    : entity.kind === "project"
      ? `/projects/${entity.slug ?? entity.id}`
      : entity.kind === "proposed" || entity.kind === "untriaged"
      ? `/task/${entity.id}`
      : entity.kind === "experiment"
        ? `/experiment/${entity.id}`
        : entity.kind === "run"
          ? `/run/${entity.id}`
          : entity.kind === "research_idea"
          ? `/lit/ideas/${entity.slug ?? entity.id}`
          : entity.kind === "lit_item"
            ? `/lit/items/${entity.id}`
            : null;
  const ghHref =
    entity.githubIssueNumber != null
      ? `https://github.com/superkaiba/explore-persona-space/issues/${entity.githubIssueNumber}`
      : null;
  const sourceHref = entity.kind === "lit_item" ? entity.url : null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-subtle/40 px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_COLOR[entity.kind]}`}
          />
          <span>{KIND_LABEL[entity.kind]}</span>
          {entity.kind === "claim" && entity.confidence && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${CONF_BADGE[entity.confidence]}`}
            >
              {entity.confidence}
            </span>
          )}
          {(entity.kind === "experiment" ||
            entity.kind === "project" ||
            entity.kind === "run" ||
            entity.kind === "proposed" ||
            entity.kind === "untriaged" ||
            entity.kind === "research_idea" ||
            entity.kind === "lit_item") &&
            entity.status && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal ${statusBadgeClass(entity.status)}`}
            >
              {entity.status.replace(/_/g, " ")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {ghHref && (
              <a
                href={ghHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                #{entity.githubIssueNumber}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {sourceHref && (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                source
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {fullPageHref && (
              <Link
                href={fullPageHref}
                className="inline-flex items-center gap-1 normal-case tracking-normal text-muted hover:text-fg"
                title="Open full page (linked entities, comments, edit)"
              >
                <Maximize2 className="h-3 w-3" />
                full page
              </Link>
            )}
          </div>
        </div>
        <h1 className="mt-2 text-[15px] font-semibold leading-tight">{entity.title}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {entity.hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entity.hero.url}
              alt={entity.hero.caption ?? "hero"}
              className="mb-5 w-full rounded-md border border-border"
            />
          )}
          <div className="prose-tight text-[12.5px]">
            {entity.body ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    if (typeof href === "string" && href.startsWith("issue:")) {
                      const n = parseInt(href.slice(6), 10);
                      if (!Number.isNaN(n)) return <IssueRef num={n}>{children}</IssueRef>;
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table>{children}</table>
                    </div>
                  ),
                  // eslint-disable-next-line @next/next/no-img-element
                  img: ({ src, alt }) =>
                    src ? <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" /> : null,
                }}
              >
                {linkifyIssueRefs(entity.body)}
              </ReactMarkdown>
            ) : (
              <p className="italic text-muted">
                No body{ghHref ? <> — see GitHub issue.</> : "."}
              </p>
            )}
          </div>
        </div>

        {isClaim && (
          <aside className="flex w-[42%] min-w-[300px] max-w-[480px] shrink-0 flex-col border-l border-border bg-subtle/20">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              <Sparkles className="h-3 w-3" />
              Chat
            </div>
            <div className="flex-1 overflow-hidden">
              <ClaimChatTab
                claimId={entity.id}
                claimTitle={entity.title}
                currentUserEmail={currentUserEmail}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

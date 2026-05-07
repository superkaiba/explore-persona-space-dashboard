"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Maximize2, Sparkles, FileText } from "lucide-react";
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
  githubIssueNumber: number | null;
  hero: { url: string; caption: string | null } | null;
};

const CONF_BADGE: Record<NonNullable<Confidence>, string> = {
  HIGH: "bg-confidence-high text-white",
  MODERATE: "bg-confidence-moderate text-black",
  LOW: "bg-confidence-low text-white",
};

const KIND_LABEL: Record<WindowKind, string> = {
  claim: "Claim",
  experiment: "In progress",
  proposed: "Proposed",
  untriaged: "Untriaged",
};

const KIND_COLOR: Record<WindowKind, string> = {
  claim: "bg-confidence-low",
  experiment: "bg-running",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
};

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
  const [tab, setTab] = useState<"body" | "chat">("body");

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
  const fullPageHref = isClaim ? `/claim/${entity.id}` : null;
  const ghHref =
    entity.githubIssueNumber != null
      ? `https://github.com/superkaiba/explore-persona-space/issues/${entity.githubIssueNumber}`
      : null;

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
          {entity.kind === "experiment" && entity.status && (
            <span className="rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-running">
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

        {isClaim && (
          <div className="mt-3 flex gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setTab("body")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                tab === "body"
                  ? "bg-fg text-canvas"
                  : "text-muted hover:bg-subtle hover:text-fg"
              }`}
            >
              <FileText className="h-3 w-3" />
              Body
            </button>
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                tab === "chat"
                  ? "bg-fg text-canvas"
                  : "text-muted hover:bg-subtle hover:text-fg"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Chat
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden">
        {isClaim && tab === "chat" ? (
          <ClaimChatTab
            claimId={entity.id}
            claimTitle={entity.title}
            currentUserEmail={currentUserEmail}
          />
        ) : (
          <div className="h-full overflow-y-auto p-6">
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
        )}
      </div>
    </div>
  );
}

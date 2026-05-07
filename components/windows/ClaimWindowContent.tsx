"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Maximize2 } from "lucide-react";

type Confidence = "HIGH" | "MODERATE" | "LOW" | null;

const CONF_BADGE: Record<NonNullable<Confidence>, string> = {
  HIGH: "bg-confidence-high text-white",
  MODERATE: "bg-confidence-moderate text-black",
  LOW: "bg-confidence-low text-white",
};

type Claim = {
  id: string;
  title: string;
  confidence: Confidence;
  githubIssueNumber: number | null;
  body: string;
  hero: { url: string; caption: string | null } | null;
};

export function ClaimWindowContent({ claimId }: { claimId: string }) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/claim/${claimId}/full`);
      if (!r.ok) {
        if (!cancelled) setError(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as Claim;
      if (!cancelled) setClaim(j);
    })();
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  if (error)
    return (
      <div className="p-4 text-[13px] text-red-600">Failed to load claim: {error}</div>
    );
  if (!claim)
    return <div className="p-4 text-[12px] text-muted">Loading…</div>;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border bg-subtle/40 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          <span>Claim</span>
          {claim.confidence && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${CONF_BADGE[claim.confidence]}`}
            >
              {claim.confidence}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {claim.githubIssueNumber != null && (
              <a
                href={`https://github.com/superkaiba/explore-persona-space/issues/${claim.githubIssueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono normal-case tracking-normal text-muted hover:text-fg"
              >
                #{claim.githubIssueNumber}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            <Link
              href={`/claim/${claim.id}`}
              className="inline-flex items-center gap-1 normal-case tracking-normal text-muted hover:text-fg"
              title="Open full page (linked entities, comments, edit)"
            >
              <Maximize2 className="h-3 w-3" />
              full page
            </Link>
          </div>
        </div>
        <h1 className="mt-2 text-[16px] font-semibold leading-tight">{claim.title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {claim.hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={claim.hero.url}
            alt={claim.hero.caption ?? "hero"}
            className="mb-4 w-full rounded-md border border-border"
          />
        )}
        <div className="prose-tight text-[12.5px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
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
            {claim.body || "_(no body)_"}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

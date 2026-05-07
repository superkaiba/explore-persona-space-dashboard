"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pin, PinOff, X } from "lucide-react";
import type { EntityKind } from "./EntityNode";

export type HoverEntity = {
  id: string;
  kind: EntityKind;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  status: string | null;
  githubIssueNumber: number | null;
  body: string;
};

type Props = {
  entity: HoverEntity;
  pinned: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  onTogglePin: () => void;
};

const KIND_LABEL: Record<EntityKind, string> = {
  claim: "Claim",
  experiment: "In progress",
  proposed: "Proposed",
  untriaged: "Untriaged",
};

const KIND_DOT: Record<EntityKind, string> = {
  claim: "bg-confidence-low",
  experiment: "bg-running",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
};

const CONF_BG: Record<NonNullable<HoverEntity["confidence"]>, string> = {
  HIGH: "bg-confidence-high text-white",
  MODERATE: "bg-confidence-moderate text-black",
  LOW: "bg-confidence-low text-white",
};

export default function EntityHoverPanel({
  entity,
  pinned,
  onMouseEnter,
  onMouseLeave,
  onClose,
  onTogglePin,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [entity.id]);

  const dotClass =
    entity.kind === "claim" && entity.confidence === "HIGH"
      ? "bg-confidence-high"
      : entity.kind === "claim" && entity.confidence === "MODERATE"
        ? "bg-confidence-moderate"
        : KIND_DOT[entity.kind];

  return (
    <>
      {/* Subtle backdrop so the centered preview reads as "modal-like" */}
      <div className="pointer-events-none fixed inset-0 z-20 bg-canvas/30" />
      <div
        ref={ref}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={[
          "panel pointer-events-auto fixed left-1/2 top-1/2 z-20 flex max-h-[80vh] w-[min(640px,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl shadow-rail transition-shadow",
          pinned ? "ring-2 ring-running/30" : "",
        ].join(" ")}
      >
      <header className="flex items-start gap-3 border-b border-border bg-subtle p-3">
        <div className="flex flex-col items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <span>{KIND_LABEL[entity.kind]}</span>
            {entity.kind === "claim" && entity.confidence && (
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${CONF_BG[entity.confidence]}`}>
                {entity.confidence}
              </span>
            )}
            {entity.kind === "experiment" && entity.status && (
              <span className="rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-running">
                {entity.status.replace(/_/g, " ")}
              </span>
            )}
            {pinned && (
              <span className="rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-running">
                pinned
              </span>
            )}
          </div>
          <div className="mt-1 text-[14px] font-semibold leading-snug">{entity.title}</div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
            {entity.githubIssueNumber != null && (
              <a
                href={`https://github.com/superkaiba/explore-persona-space/issues/${entity.githubIssueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-fg"
              >
                #{entity.githubIssueNumber} ↗
              </a>
            )}
            {entity.kind === "claim" && (
              <Link href={`/claim/${entity.id}`} className="hover:text-fg">
                open detail page →
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={pinned ? "Unpin preview" : "Pin preview"}
            title={pinned ? "Unpin (click again to dismiss with the X)" : "Click to pin"}
            className={[
              "rounded-md p-1 transition-colors",
              pinned
                ? "bg-running/10 text-running hover:bg-running/20"
                : "text-muted hover:bg-border hover:text-fg",
            ].join(" ")}
          >
            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md p-1 text-muted transition-colors hover:bg-border hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="prose-tight flex-1 overflow-y-auto p-4 text-[12.5px]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @next/next/no-img-element
            img: ({ src, alt }) =>
              src ? (
                <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" />
              ) : null,
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
          }}
        >
          {entity.body || "_(no body)_"}
        </ReactMarkdown>
      </div>
      </div>
    </>
  );
}

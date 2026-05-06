"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { confidenceClass } from "@/lib/utils";

export type HoverClaim = {
  id: string;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  githubIssueNumber: number | null;
  body: string;
};

type Props = {
  claim: HoverClaim;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
};

export default function ClaimHoverPanel({
  claim,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Reset scroll when claim changes so user starts at the top of each preview.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [claim.id]);

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="panel pointer-events-auto absolute right-4 top-4 z-20 flex max-h-[calc(100vh-2rem)] w-[480px] flex-col overflow-hidden rounded-lg shadow-xl"
    >
      <header className="flex items-start gap-2 border-b p-3">
        <span
          className={`mt-1 inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${confidenceClass(
            claim.confidence,
          )}`}
        >
          {claim.confidence ?? "—"}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium leading-snug">{claim.title}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
            {claim.githubIssueNumber != null && (
              <>
                <a
                  href={`https://github.com/superkaiba/explore-persona-space/issues/${claim.githubIssueNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  #{claim.githubIssueNumber} ↗
                </a>
                <span>·</span>
              </>
            )}
            <Link href={`/claim/${claim.id}`} className="hover:underline">
              open detail page →
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ✕
        </button>
      </header>

      <div className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-y-auto p-4 text-[13px] leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @next/next/no-img-element
            img: ({ src, alt }) =>
              src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} className="rounded border" />
              ) : null,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="my-2 w-full border-collapse text-xs">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b border-neutral-300 px-2 py-1 text-left font-medium dark:border-neutral-700">{children}</th>
            ),
            td: ({ children }) => (
              <td className="border-b border-neutral-200 px-2 py-1 align-top dark:border-neutral-800">{children}</td>
            ),
            code: ({ children, className }) =>
              className ? (
                <code className={className}>{children}</code>
              ) : (
                <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px] dark:bg-neutral-800">{children}</code>
              ),
          }}
        >
          {claim.body || "_(empty body)_"}
        </ReactMarkdown>
      </div>
    </div>
  );
}

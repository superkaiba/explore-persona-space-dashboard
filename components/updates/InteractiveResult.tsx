"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Maximize2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CleanResult } from "@/lib/update-results";
import { dayKey, formatTime } from "@/lib/update-results";
import { ClaudeAskButton, type ClaudeAskPayload } from "@/components/updates/MentorClaudePanel";
import { cn } from "@/lib/utils";

export function InteractiveResultCard({
  result,
  internal,
}: {
  result: CleanResult;
  internal: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <article className="rounded-lg border border-border bg-panel p-4 transition-colors hover:bg-subtle/35">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <ResultBadge result={result} />
              {result.confidence && <span className="font-mono">{result.confidence}</span>}
              <span className="font-mono">{formatTime(result.updatedAt)}</span>
            </div>
            <h2 className="mt-2 text-[15px] font-semibold leading-snug text-fg">
              {result.title}
            </h2>
            {result.excerpt && (
              <p className="mt-3 text-[13px] leading-relaxed text-fg-soft">
                {result.excerpt}
              </p>
            )}
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted">
              <Maximize2 className="h-3.5 w-3.5" />
              Open full result
            </span>
          </button>
          <ClaudeAskButton
            compact
            payload={resultAskPayload(result)}
            label={`Ask Claude about ${result.title}`}
            className="mt-0.5"
          />
        </div>
        {internal && <InternalLinks result={result} />}
      </article>

      {open && (
        <ResultDetailOverlay
          result={result}
          internal={internal}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function InteractiveResultRow({
  result,
  internal,
}: {
  result: CleanResult;
  internal: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-md border border-border bg-panel px-3 py-2 transition-colors hover:bg-subtle/35">
        <div className="flex min-w-0 items-start gap-3">
          <ResultBadge result={result} compact />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="line-clamp-2 text-[13px] font-medium leading-snug text-fg">
              {result.title}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              {result.confidence && <span className="font-mono">{result.confidence}</span>}
              <span className="font-mono">{formatTime(result.updatedAt)}</span>
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="h-3 w-3" />
                Open
              </span>
            </div>
          </button>
          <ClaudeAskButton
            compact
            payload={resultAskPayload(result)}
            label={`Ask Claude about ${result.title}`}
          />
        </div>
        {internal && <InternalLinks result={result} compact />}
      </div>

      {open && (
        <ResultDetailOverlay
          result={result}
          internal={internal}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ResultDetailOverlay({
  result,
  internal,
  onClose,
}: {
  result: CleanResult;
  internal: boolean;
  onClose: () => void;
}) {
  const markdown = result.body || result.excerpt || "No result body is available.";
  const askPayload = useMemo(() => resultAskPayload(result), [result]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`result-${result.id}-title`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-rail"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <ResultBadge result={result} />
              {result.confidence && <span className="font-mono">{result.confidence}</span>}
              <span className="font-mono">
                {dayKey(result.updatedAt)} {formatTime(result.updatedAt)}
              </span>
            </div>
            <h2
              id={`result-${result.id}-title`}
              className="text-[16px] font-semibold leading-snug text-fg"
            >
              {result.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ClaudeAskButton payload={askPayload} label="Ask Claude" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg"
              aria-label="Close result"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="prose prose-sm max-w-none prose-headings:text-fg prose-p:text-fg-soft prose-strong:text-fg prose-code:text-fg prose-pre:border prose-pre:border-border prose-pre:bg-subtle prose-li:text-fg-soft prose-a:text-accent">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {children}
                </a>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
          </div>
        </div>

        {internal && (
          <footer className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-[12px] text-muted">
            <Link href={result.href} className="inline-flex items-center gap-1 hover:text-fg">
              Open claim
              <ExternalLink className="h-3 w-3" />
            </Link>
            {result.githubIssueNumber != null && (
              <a
                href={`https://github.com/superkaiba/explore-persona-space/issues/${result.githubIssueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-fg"
              >
                GitHub #{result.githubIssueNumber}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function ResultBadge({ result, compact = false }: { result: CleanResult; compact?: boolean }) {
  const Icon = result.useful ? CheckCircle2 : AlertTriangle;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium",
        compact ? "text-[10px]" : "text-[11px]",
        result.useful
          ? "border-confidence-high/35 bg-confidence-high/10 text-confidence-high"
          : "border-confidence-low/40 bg-confidence-low/10 text-muted",
      )}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {result.useful ? "Useful" : "Not useful"}
    </span>
  );
}

function InternalLinks({
  result,
  compact = false,
}: {
  result: CleanResult;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-[11px] text-muted",
        compact ? "mt-2 pl-16" : "mt-3",
      )}
    >
      <Link href={result.href} className="hover:text-fg">
        Open claim
      </Link>
      {result.githubIssueNumber != null && (
        <a
          href={`https://github.com/superkaiba/explore-persona-space/issues/${result.githubIssueNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg"
        >
          GitHub #{result.githubIssueNumber}
        </a>
      )}
    </div>
  );
}

function resultAskPayload(result: CleanResult): ClaudeAskPayload {
  return {
    scopeTitle: result.title,
    contextMd: resultContext(result),
    suggestedQuestion: "Can you explain what this result means and what I should ask next?",
  };
}

function resultContext(result: CleanResult) {
  return [
    `Result: ${result.title}`,
    `Classification: ${result.useful ? "useful" : "not useful"}`,
    `Confidence: ${result.confidence ?? "not set"}`,
    `Updated: ${dayKey(result.updatedAt)} ${formatTime(result.updatedAt)}`,
    `URL: ${result.href}`,
    "",
    "Full result:",
    result.body || result.excerpt || "No result body available.",
  ].join("\n");
}

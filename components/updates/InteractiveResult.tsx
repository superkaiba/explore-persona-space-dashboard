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
import {
  dayKey,
  formatTime,
  type CleanResult,
  type CleanResultDateField,
} from "@/lib/update-results";
import {
  ClaudeAskButton,
  ClaudeAskComposer,
  clearClaudeHover,
  dispatchClaudeHover,
  type ClaudeAskPayload,
} from "@/components/updates/MentorClaudePanel";
import { CommentThread } from "@/components/discussion/CommentThread";
import { cn } from "@/lib/utils";

export function InteractiveResultCard({
  result,
  internal,
  dateField = "updatedAt",
}: {
  result: CleanResult;
  internal: boolean;
  dateField?: CleanResultDateField;
}) {
  const [open, setOpen] = useState(false);
  const askPayload = useMemo(() => resultAskPayload(result), [result]);

  return (
    <>
      <article
        data-claude-anchor
        data-claude-scope-id={result.id}
        onMouseEnter={(event) => dispatchClaudeHover(askPayload, event.currentTarget)}
        onMouseLeave={(event) => clearClaudeHover(event.currentTarget)}
        onFocus={(event) => dispatchClaudeHover(askPayload, event.currentTarget)}
        onBlur={(event) => clearClaudeHover(event.currentTarget)}
        className="rounded-lg border border-border bg-panel p-4 transition-colors hover:bg-subtle/35 data-[claude-hovered=true]:border-accent data-[claude-hovered=true]:bg-accent/10"
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <ResultBadge result={result} />
              {result.confidence && <span className="font-mono">{result.confidence}</span>}
              <span className="font-mono">{formatTime(result[dateField])}</span>
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
            payload={askPayload}
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
          dateField={dateField}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function InteractiveResultRow({
  result,
  internal,
  dateField = "updatedAt",
}: {
  result: CleanResult;
  internal: boolean;
  dateField?: CleanResultDateField;
}) {
  const [open, setOpen] = useState(false);
  const askPayload = useMemo(() => resultAskPayload(result), [result]);

  return (
    <>
      <div
        data-claude-anchor
        data-claude-scope-id={result.id}
        onMouseEnter={(event) => dispatchClaudeHover(askPayload, event.currentTarget)}
        onMouseLeave={(event) => clearClaudeHover(event.currentTarget)}
        onFocus={(event) => dispatchClaudeHover(askPayload, event.currentTarget)}
        onBlur={(event) => clearClaudeHover(event.currentTarget)}
        className="rounded-md border border-border bg-panel px-3 py-2 transition-colors hover:bg-subtle/35 data-[claude-hovered=true]:border-accent data-[claude-hovered=true]:bg-accent/10"
      >
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
              <span className="font-mono">{formatTime(result[dateField])}</span>
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="h-3 w-3" />
                Open
              </span>
            </div>
          </button>
          <ClaudeAskButton
            compact
            payload={askPayload}
            label={`Ask Claude about ${result.title}`}
          />
        </div>
        {internal && <InternalLinks result={result} compact />}
      </div>

      {open && (
        <ResultDetailOverlay
          result={result}
          internal={internal}
          dateField={dateField}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ResultDetailOverlay({
  result,
  internal,
  dateField,
  onClose,
}: {
  result: CleanResult;
  internal: boolean;
  dateField: CleanResultDateField;
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
                {dayKey(result[dateField])} {formatTime(result[dateField])}
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
            <ClaudeAskButton payload={askPayload} label="Ask Claude Code" />
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
          <ClaudeAskComposer
            payload={askPayload}
            placeholder="Ask Claude Code to inspect this result..."
            className="mb-4 bg-subtle/30"
          />
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
          {isUuid(result.id) && (
            <section className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
                Comments
              </div>
              <CommentThread
                claimId={result.id}
                claimTitle={result.title}
                canPost
                publicPost
                canAskClaude
              />
            </section>
          )}
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
    scopeKind: "result",
    scopeId: result.id,
    sourceLabel:
      result.githubIssueNumber == null
        ? `Claim ${result.id.slice(0, 8)}`
        : `Issue #${result.githubIssueNumber}`,
    scopeTitle: result.title,
    contextMd: resultContext(result),
    suggestedQuestion: "Inspect this result and explain what it means.",
  };
}

function resultContext(result: CleanResult) {
  const resultUrl = result.href.startsWith("http")
    ? result.href
    : `https://dashboard.superkaiba.com${result.href}`;
  const inspectionHint = result.href.startsWith("http")
    ? "Inspect the full GitHub issue body and linked artifacts before answering. Use curl/git/shell tools to inspect or download referenced artifacts."
    : "Inspect the full result yourself before answering. Use psql against $DASHBOARD_DATABASE_URL to fetch claim.body_json and comments for this claim id, and use curl/git/shell tools to inspect or download referenced artifacts.";
  return [
    "Claude Code inspection target:",
    `Title: ${result.title}`,
    `Result ID: ${result.id}`,
    `Classification: ${result.useful ? "useful" : "not useful"}`,
    `Confidence: ${result.confidence ?? "not set"}`,
    `GitHub issue created: ${dayKey(result.createdAt)} ${formatTime(result.createdAt)}`,
    `Dashboard updated: ${dayKey(result.updatedAt)} ${formatTime(result.updatedAt)}`,
    `Result URL: ${resultUrl}`,
    result.githubIssueNumber == null
      ? null
      : `GitHub issue: https://github.com/superkaiba/explore-persona-space/issues/${result.githubIssueNumber}`,
    "",
    inspectionHint,
    "",
    "Full result:",
    "Not included in this prompt; fetch it from the dashboard database or linked artifacts when needed.",
    "",
    "Excerpt:",
    result.excerpt || "No excerpt available.",
  ]
    .filter(Boolean)
    .join("\n");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

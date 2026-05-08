"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Maximize2,
  MessageSquare,
  Quote,
  Send,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CleanResult } from "@/lib/update-results";
import { dayKey, formatTime } from "@/lib/update-results";
import {
  ClaudeAskButton,
  ClaudeAskComposer,
  clearClaudeHover,
  dispatchClaudeHover,
  type ClaudeAskPayload,
} from "@/components/updates/MentorClaudePanel";
import { cn } from "@/lib/utils";

export function InteractiveResultCard({
  result,
  internal,
}: {
  result: CleanResult;
  internal: boolean;
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
        className="rounded-lg border border-border bg-panel p-4 transition-colors hover:bg-subtle/35 data-[claude-connected=true]:border-accent/60 data-[claude-connected=true]:bg-accent/5 data-[claude-hovered=true]:border-accent data-[claude-hovered=true]:bg-accent/10"
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
        className="rounded-md border border-border bg-panel px-3 py-2 transition-colors hover:bg-subtle/35 data-[claude-connected=true]:border-accent/60 data-[claude-connected=true]:bg-accent/5 data-[claude-hovered=true]:border-accent data-[claude-hovered=true]:bg-accent/10"
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
              <span className="font-mono">{formatTime(result.updatedAt)}</span>
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
          <MentorResultComments resultId={result.id} />
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
    scopeTitle: result.title,
    contextMd: resultContext(result),
    suggestedQuestion: "Inspect this result and explain what it means.",
  };
}

function resultContext(result: CleanResult) {
  return [
    "Claude Code inspection target:",
    `Title: ${result.title}`,
    `Claim ID: ${result.id}`,
    `Classification: ${result.useful ? "useful" : "not useful"}`,
    `Confidence: ${result.confidence ?? "not set"}`,
    `Updated: ${dayKey(result.updatedAt)} ${formatTime(result.updatedAt)}`,
    `Dashboard URL: https://dashboard.superkaiba.com${result.href}`,
    result.githubIssueNumber == null
      ? null
      : `GitHub issue: https://github.com/superkaiba/explore-persona-space/issues/${result.githubIssueNumber}`,
    "",
    "Inspect the full result yourself before answering. Use psql against $DASHBOARD_DATABASE_URL to fetch claim.body_json and comments for this claim id, and use curl/git/shell tools to inspect or download referenced artifacts.",
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

type MentorComment = {
  id: string;
  author: string;
  authorKind: string;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
};

function formatCommentDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseComment(body: string) {
  const match = body.match(/^Comment on:\n> ([^\n]+)\n\n([\s\S]*)$/);
  return match ? { anchorText: match[1], text: match[2] } : { text: body };
}

function MentorResultComments({ resultId }: { resultId: string }) {
  const [comments, setComments] = useState<MentorComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthor(window.localStorage.getItem("eps-mentor-comment-author") ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    fetch(`/api/claim/${resultId}/comments`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as { comments: MentorComment[] };
      })
      .then((data) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  function useSelection() {
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (selected) setAnchorText(selected.slice(0, 2000));
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || posting) return;

    setPosting(true);
    setError(null);
    try {
      window.localStorage.setItem("eps-mentor-comment-author", author.trim());
      const res = await fetch(`/api/mentor/claim/${resultId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: author.trim() || undefined,
          body: text,
          anchorText: anchorText || undefined,
          website: "",
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as { comment: MentorComment };
      setComments((current) => [...current, data.comment]);
      setDraft("");
      setAnchorText("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="mt-5 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <MessageSquare className="h-4 w-4 text-muted" />
          Comments
        </div>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={useSelection}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-2 py-1 text-[11px] text-muted hover:bg-raised hover:text-fg"
        >
          <Quote className="h-3.5 w-3.5" />
          Use selected text
        </button>
      </div>

      {anchorText && (
        <div className="mb-3 rounded-md border border-border bg-subtle/50 p-2 text-[12px] text-muted">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-fg-soft">Selection</span>
            <button
              type="button"
              onClick={() => setAnchorText("")}
              className="text-[11px] hover:text-fg"
            >
              Clear
            </button>
          </div>
          <p className="line-clamp-4 leading-relaxed">{anchorText}</p>
        </div>
      )}

      <form onSubmit={submit} className="mb-4 space-y-2">
        <input
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Name"
          className="w-full rounded-md border border-border bg-canvas px-2.5 py-1.5 text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Add a comment..."
            disabled={posting}
            className="min-h-[72px] flex-1 resize-none rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] leading-relaxed text-fg placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={posting || !draft.trim()}
            className="grid h-10 w-10 place-items-center rounded-md bg-fg text-canvas disabled:opacity-40"
            aria-label="Post comment"
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-3 rounded-md border border-confidence-low/30 bg-confidence-low/10 p-2 text-[12px] text-muted">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="text-[12px] text-muted">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-[12px] text-muted">
          No comments yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const parsed = parseComment(comment.body);
            return (
              <li key={comment.id} className="rounded-md border border-border bg-subtle/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
                  <span className="font-medium text-fg">{comment.authorEmail ?? comment.author}</span>
                  <span className="font-mono text-[10px] text-muted">
                    {formatCommentDate(comment.createdAt)}
                  </span>
                </div>
                {parsed.anchorText && (
                  <blockquote className="mb-2 border-l border-border pl-2 text-[12px] leading-relaxed text-muted">
                    {parsed.anchorText}
                  </blockquote>
                )}
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-soft">
                  {parsed.text}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

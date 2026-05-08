"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, MessageSquare, Quote, Reply, Send } from "lucide-react";
import {
  buildCommentTree,
  type ParsedComment,
  type PersistedComment,
} from "@/lib/comment-format";
import { postSidecarChat } from "@/lib/sidecar-client";

type Comment = PersistedComment;

type Props = {
  claimId: string;
  claimTitle: string;
  canPost: boolean;
  publicPost?: boolean;
  canAskClaude?: boolean;
};

function fmt(d: string): string {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function CommentThread({
  claimId,
  claimTitle,
  canPost,
  publicPost = false,
  canAskClaude = false,
}: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [replyTo, setReplyTo] = useState<ParsedComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claudePendingId, setClaudePendingId] = useState<string | null>(null);
  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  useEffect(() => {
    if (publicPost) {
      setAuthor(window.localStorage.getItem("eps-mentor-comment-author") ?? "");
    }
  }, [publicPost]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    (async () => {
      const r = await fetch(`/api/claim/${claimId}/comments`);
      if (!r.ok) {
        if (!cancelled) {
          setError(await r.text());
          setLoaded(true);
        }
        return;
      }
      const j = (await r.json()) as { comments: Comment[] };
      if (!cancelled) {
        setComments(j.comments);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  function useSelection() {
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (selected) setAnchorText(selected.slice(0, 2000));
  }

  async function postComment({
    text,
    parentCommentId,
    authorName,
  }: {
    text: string;
    parentCommentId?: string | null;
    authorName?: string;
  }) {
    const useMentorEndpoint = publicPost || authorName;
    const url = useMentorEndpoint
      ? `/api/mentor/claim/${claimId}/comments`
      : `/api/claim/${claimId}/comments`;
    const body = useMentorEndpoint
      ? {
          author: authorName ?? (author.trim() || undefined),
          body: text,
          anchorText: anchorText || undefined,
          parentCommentId: parentCommentId || undefined,
          website: "",
        }
      : {
          body: text,
          anchorText: anchorText || undefined,
          parentCommentId: parentCommentId || undefined,
        };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(await r.text());
    }
    return ((await r.json()) as { comment: Comment }).comment;
  }

  async function send() {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    try {
      if (publicPost) {
        window.localStorage.setItem("eps-mentor-comment-author", author.trim());
      }
      const comment = await postComment({
        text,
        parentCommentId: replyTo?.id,
      });
      setComments((c) => [...c, comment]);
      setDraft("");
      setAnchorText("");
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  }

  async function answerWithClaude(comment: ParsedComment) {
    if (claudePendingId) return;
    setClaudePendingId(comment.id);
    setError(null);
    try {
      const tokenRes = await fetch("/api/chat-token", { method: "POST" });
      if (!tokenRes.ok) {
        throw new Error(`Claude is available after sign-in. ${await tokenRes.text()}`);
      }
      const { token, sidecar_url: sidecarUrl } = (await tokenRes.json()) as {
        token: string;
        sidecar_url: string;
      };
      const res = await postSidecarChat(sidecarUrl, token, {
        session_id: `claim-comment-${claimId}-${comment.id}`,
        provider: "claude_code",
        messages: [
          {
            role: "user",
            content: [
              `You are Claude Code answering a persisted comment on dashboard claim "${claimTitle}" (${claimId}).`,
              "Inspect the VM, dashboard database, GitHub issue, and linked artifacts if needed before answering.",
              "Write only the concise reply text that should be posted under the comment.",
              "",
              `Comment author: ${comment.authorEmail ?? comment.author}`,
              `Comment: ${comment.text}`,
            ].join("\n"),
          },
        ],
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text().catch(() => res.statusText));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const eventText of events) {
          const parsed = parseSseEvent(eventText);
          if (!parsed) continue;
          if (parsed.eventName === "token") {
            answer += String(parsed.data.text ?? "");
          } else if (parsed.eventName === "error") {
            throw new Error(String(parsed.data.message ?? "Claude Code failed"));
          }
        }
      }

      const text = answer.trim();
      if (!text) throw new Error("Claude Code returned an empty answer.");
      const reply = await postComment({
        text,
        parentCommentId: comment.id,
        authorName: "Claude Code",
      });
      setComments((current) => [...current, reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaudePendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
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
        <div className="rounded-md border border-border bg-subtle/50 p-2 text-[12px] text-muted">
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

      {replyTo && (
        <div className="rounded-md border border-border bg-subtle/50 px-3 py-2 text-[12px] text-muted">
          <div className="flex items-center justify-between gap-2">
            <span>
              Replying to <span className="font-medium text-fg">{replyTo.authorEmail ?? replyTo.author}</span>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="hover:text-fg">
              Cancel
            </button>
          </div>
          <p className="mt-1 line-clamp-2">{replyTo.text}</p>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-confidence-low/30 bg-confidence-low/10 p-3 text-[12px] text-muted">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="text-[12px] text-muted">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle/40 p-3 text-center text-[12px] text-muted">
          <MessageSquare className="mx-auto mb-1 h-3 w-3" />
          No comments yet
          {canPost ? " - leave the first one below." : "."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tree.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canPost={canPost}
              canAskClaude={canAskClaude}
              claudePendingId={claudePendingId}
              onReply={setReplyTo}
              onAskClaude={(target) => void answerWithClaude(target)}
            />
          ))}
        </ul>
      )}

      {canPost && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="space-y-2"
        >
          {publicPost && (
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Name"
              className="w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-[12px] text-fg placeholder:text-muted focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
            />
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={replyTo ? "Write a reply...  (cmd/ctrl+enter to send)" : "Leave a comment...  (cmd/ctrl+enter to send)"}
              rows={2}
              disabled={posting}
              className="flex-1 resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              className="rounded-md bg-fg p-2 text-canvas disabled:opacity-30"
              aria-label="Post comment"
            >
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  canPost,
  canAskClaude,
  claudePendingId,
  onReply,
  onAskClaude,
}: {
  comment: ParsedComment;
  canPost: boolean;
  canAskClaude: boolean;
  claudePendingId: string | null;
  onReply: (comment: ParsedComment) => void;
  onAskClaude: (comment: ParsedComment) => void;
}) {
  const claudePending = claudePendingId === comment.id;
  return (
    <li className="panel rounded-md p-3">
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="font-medium text-fg">{comment.authorEmail ?? comment.author}</span>
        <span className="font-mono text-[10px] text-muted">{fmt(comment.createdAt)}</span>
      </div>
      {comment.anchorText && (
        <blockquote className="mb-2 border-l border-border pl-2 text-[12px] leading-relaxed text-muted">
          {comment.anchorText}
        </blockquote>
      )}
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">
        {comment.text}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canPost && (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
        )}
        {canAskClaude && (
          <button
            type="button"
            onClick={() => onAskClaude(comment)}
            disabled={Boolean(claudePendingId)}
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg disabled:opacity-50"
          >
            {claudePending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bot className="h-3 w-3" />
            )}
            Ask Claude Code
          </button>
        )}
      </div>
      {comment.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-l border-border pl-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              canPost={canPost}
              canAskClaude={canAskClaude}
              claudePendingId={claudePendingId}
              onReply={onReply}
              onAskClaude={onAskClaude}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function parseSseEvent(eventText: string) {
  if (!eventText.trim()) return null;
  let eventName = "message";
  let dataStr = "";
  for (const line of eventText.split(/\r?\n/)) {
    if (line.startsWith("event: ")) eventName = line.slice(7).trim();
    if (line.startsWith("data: ")) dataStr += line.slice(6).trim();
  }
  if (!dataStr) return null;
  try {
    return { eventName, data: JSON.parse(dataStr) as Record<string, unknown> };
  } catch {
    return null;
  }
}

"use client";

import { useEffect, useState } from "react";
import { Send, MessageSquare } from "lucide-react";

type Comment = {
  id: string;
  author: string;
  authorKind: string;
  body: string;
  createdAt: string;
};

type Props = {
  claimId: string;
  canPost: boolean;
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

export function CommentThread({ claimId, canPost }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/claim/${claimId}/comments`);
      if (!r.ok) return;
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

  async function send() {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/claim/${claimId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!r.ok) {
        alert(`Failed: ${await r.text()}`);
        return;
      }
      const j = (await r.json()) as { comment: Comment };
      setComments((c) => [...c, j.comment]);
      setDraft("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!loaded ? (
        <p className="text-[12px] text-muted">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle/40 p-3 text-center text-[12px] text-muted">
          <MessageSquare className="mx-auto mb-1 h-3 w-3" />
          No comments yet
          {canPost ? " — leave the first one below." : "."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="panel rounded-md p-3">
              <div className="mb-1 flex items-baseline justify-between text-[11px]">
                <span className="font-medium text-fg">{c.author}</span>
                <span className="font-mono text-[10px] text-muted">{fmt(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Leave a comment…  (⌘↵ to send)"
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
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

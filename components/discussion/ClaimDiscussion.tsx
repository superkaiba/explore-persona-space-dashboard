"use client";

import { useEffect, useState } from "react";
import { MessageSquare, MessageCircle, Plus, Sparkles } from "lucide-react";
import { CommentThread } from "./CommentThread";
import { ConversationView } from "./ConversationView";
import { PresenceIndicator } from "./PresenceIndicator";

type Session = {
  id: string;
  title: string | null;
  createdByUserId: string | null;
  createdByUserEmail: string | null;
  lastUserId: string | null;
  lastUserEmail: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  messageCount: number;
};

type Tab = "conversations" | "comments";

type Props = {
  claimId: string;
  claimTitle: string;
  canPost: boolean;
  currentUserEmail: string | null;
};

function fmtRelative(d: string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function ClaimDiscussion({ claimId, claimTitle, canPost, currentUserEmail }: Props) {
  const [tab, setTab] = useState<Tab>("conversations");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openSid, setOpenSid] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadSessions() {
    const r = await fetch(`/api/claim/${claimId}/conversations`);
    if (!r.ok) return;
    const j = (await r.json()) as { sessions: Session[] };
    setSessions(j.sessions);
    setLoaded(true);
  }

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function startConversation() {
    setCreating(true);
    try {
      const r = await fetch(`/api/claim/${claimId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        alert(`Failed: ${await r.text()}`);
        return;
      }
      const j = (await r.json()) as { session: Session };
      setSessions((s) => [j.session, ...s]);
      setOpenSid(j.session.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mt-12 border-t border-border pt-6">
      <div className="mb-3 flex items-center gap-1 text-[11px]">
        <div className="flex flex-1 items-center gap-1">
          <span className="hidden">.</span>
          <PresenceIndicator claimId={claimId} selfEmail={currentUserEmail} />
        </div>
        <button
          type="button"
          onClick={() => {
            setTab("conversations");
            setOpenSid(null);
          }}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
            tab === "conversations"
              ? "bg-fg text-canvas"
              : "text-muted hover:bg-subtle hover:text-fg"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          Conversations
          {sessions.length > 0 && (
            <span className="font-mono text-[10px] opacity-70">{sessions.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("comments")}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
            tab === "comments"
              ? "bg-fg text-canvas"
              : "text-muted hover:bg-subtle hover:text-fg"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          Comments
        </button>
      </div>

      {tab === "comments" ? (
        <CommentThread claimId={claimId} canPost={canPost} />
      ) : openSid ? (
        <div>
          <button
            type="button"
            onClick={() => setOpenSid(null)}
            className="mb-3 inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg"
          >
            ← back to conversations
          </button>
          <ConversationView
            claimId={claimId}
            claimTitle={claimTitle}
            sessionId={openSid}
            currentUserEmail={currentUserEmail}
          />
        </div>
      ) : (
        <ConversationsList
          loaded={loaded}
          sessions={sessions}
          canPost={canPost}
          creating={creating}
          onOpen={(sid) => setOpenSid(sid)}
          onNew={() => void startConversation()}
        />
      )}
    </section>
  );
}

function ConversationsList({
  loaded,
  sessions,
  canPost,
  creating,
  onOpen,
  onNew,
}: {
  loaded: boolean;
  sessions: Session[];
  canPost: boolean;
  creating: boolean;
  onOpen: (sid: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {canPost && (
        <button
          type="button"
          onClick={onNew}
          disabled={creating}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-subtle/40 px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-subtle hover:text-fg disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {creating ? "Starting…" : "New conversation"}
        </button>
      )}
      {!loaded ? (
        <p className="text-[12px] text-muted">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-[12px] text-muted">
          No conversations yet
          {canPost ? " — start one above to ask Claude about this claim." : "."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="flex w-full items-start gap-3 border-b border-border py-2 pr-2 text-left transition-colors hover:bg-subtle"
              >
                <MessageCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="line-clamp-1 font-medium text-fg">
                      {s.title ?? "Untitled conversation"}
                    </span>
                    <span className="font-mono text-[10px] text-muted">
                      {fmtRelative(s.lastMessageAt ?? s.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                    <span>{s.messageCount} message{s.messageCount === 1 ? "" : "s"}</span>
                    {(s.lastUserEmail || s.createdByUserEmail) && (
                      <span>· last by {s.lastUserEmail ?? s.createdByUserEmail}</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

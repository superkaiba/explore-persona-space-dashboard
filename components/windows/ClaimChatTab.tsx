"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ConversationView } from "@/components/discussion/ConversationView";

type Session = {
  id: string;
  title: string | null;
  createdByUserEmail: string | null;
  lastUserEmail: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  messageCount: number;
};

function fmtRelative(d: string | null): string {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

/**
 * Compact per-claim chat embedded in a window. Auto-loads the most recent
 * saved conversation; otherwise shows a draft chat surface and only creates
 * the DB conversation when the first message is sent.
 */
export function ClaimChatTab({
  claimId,
  claimTitle,
  currentUserEmail,
}: {
  claimId: string;
  claimTitle: string;
  currentUserEmail: string | null;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSid, setActiveSid] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    const r = await fetch(`/api/claim/${claimId}/conversations`);
    if (!r.ok) return;
    const j = (await r.json()) as { sessions: Session[] };
    setSessions(j.sessions);
    setLoaded(true);
    if (!activeSid && j.sessions.length > 0) setActiveSid(j.sessions[0].id);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function createSession() {
    setCreating(true);
    try {
      const r = await fetch(`/api/claim/${claimId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        throw new Error(await r.text());
      }
      const j = (await r.json()) as { session: Session };
      setSessions((s) => [j.session, ...s]);
      return j.session.id;
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-subtle/30 px-4 py-2 text-[11px]">
        {!loaded ? (
          <span className="text-muted">Loading…</span>
        ) : currentUserEmail ? (
          <>
            <select
              value={activeSid ?? ""}
              onChange={(e) => setActiveSid(e.target.value || null)}
              disabled={creating}
              className="rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] focus:border-running focus:outline-none"
            >
              <option value="">New conversation</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmtRelative(s.lastMessageAt ?? s.createdAt)}
                  {s.lastUserEmail ? ` · ${s.lastUserEmail}` : ""}
                  {` · ${s.messageCount ?? 0}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setActiveSid(null)}
              disabled={creating}
              title="Start a new draft"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-2 py-0.5 text-muted transition-colors hover:bg-border hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </>
        ) : (
          <span className="text-muted">Read-only — sign in to chat</span>
        )}
      </div>
      <div className="flex-1 overflow-hidden p-5">
        {!currentUserEmail ? (
          <SignInPrompt />
        ) : (
          <ConversationView
            claimId={claimId}
            claimTitle={claimTitle}
            sessionId={activeSid}
            currentUserEmail={currentUserEmail}
            createSession={createSession}
            onSessionCreated={setActiveSid}
          />
        )}
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="flex flex-col gap-2 text-[12.5px]">
      <p className="text-muted">
        Sign in to chat with Claude about this claim. Open windows are saved
        and will come back when you return.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Sign in
      </Link>
    </div>
  );
}

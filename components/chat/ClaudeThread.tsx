"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  ChevronDown,
  MessageCircle,
  Plus,
  Send,
  Wrench,
  X as XIcon,
} from "lucide-react";
import { makeClientId } from "@/lib/client-id";
import {
  AGENT_RUN_MODE_HELP,
  AGENT_RUN_MODE_LABEL,
  AGENT_RUN_MODES,
  AGENT_RUN_PROVIDER_HELP,
  AGENT_RUN_PROVIDER_LABEL,
  AGENT_RUN_PROVIDERS,
  type AgentRunMode,
  type AgentRunProvider,
  type AgentRunStatus,
} from "@/lib/agent-runs";
import { postSidecarChat } from "@/lib/sidecar-client";

type DbMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  body: string;
  toolCallJson: Record<string, unknown> | null;
  userId: string | null;
  userEmail: string | null;
  createdAt: string;
};

type Session = {
  id: string;
  title: string | null;
  agentHandle: string | null;
  createdByUserEmail: string | null;
  lastUserEmail: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  messageCount: number;
};

type ToolBlock = {
  kind: "tool";
  id: string;
  name: string;
  input: Record<string, unknown>;
  ok?: boolean;
  result?: string;
};
type TextBlock = { kind: "text"; text: string };
type ThinkingBlock = { kind: "thinking"; text: string };
type Block = TextBlock | ToolBlock | ThinkingBlock;

type StartupPhase = "spawning" | "loading" | "ready" | null;
type ThreadKind = "chat" | "improve";

type Msg =
  | { id: string; role: "user"; text: string; authorEmail: string | null }
  | {
      id: string;
      role: "assistant";
      blocks: Block[];
      cost?: number;
      durationMs?: number;
      startupPhase?: StartupPhase;
      startedAt?: number;
    };

type ClaudeThreadProps = {
  kind: ThreadKind;
  storageKey: string;
  placeholder: string;
  emptyTitle: string;
  emptyBody: string;
  className?: string;
};

type AgentRun = {
  id: string;
  mode: AgentRunMode;
  provider: AgentRunProvider;
  sandboxPreview: boolean;
  status: AgentRunStatus;
  productionUrl: string | null;
};

function sqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function runUpdateSql(runId: string, status: AgentRunStatus, eventType: string, body: string) {
  return `psql "\${DASHBOARD_DATABASE_URL%%\\?*}" -c "UPDATE agent_run SET status='${status}', updated_at=now() WHERE id='${runId}'; INSERT INTO agent_run_event (run_id, event_type, body) VALUES ('${runId}', '${eventType}', '${sqlLiteral(body)}');"`;
}

function improvementDispatchPrompt(
  request: string,
  mode: AgentRunMode,
  sandboxPreview: boolean,
  provider: AgentRunProvider,
  run: AgentRun | null,
) {
  const runId = run?.id ?? "untracked";
  const productionUrl = run?.productionUrl ?? "https://dashboard.superkaiba.com";
  const tracking =
    run?.id
      ? `Agent run id: ${run.id}
Record important progress in Postgres when useful. Example:
${runUpdateSql(run.id, "running", "progress", "Inspected relevant files.")}
If you produce a preview URL or Vercel deployment URL, update agent_run.preview_url or agent_run.vercel_deployment_url with psql.`
      : "Agent run tracking failed before dispatch; continue and report that run tracking was unavailable.";

  const agentName = AGENT_RUN_PROVIDER_LABEL[provider];
  const shared = `You are a ${agentName} implementation agent running inside /home/thomasjiralerspong/explore-persona-space-dashboard on the project VM.

The Vercel production dashboard is the live, always-evolving app:
${productionUrl}

The VM is only the agent runner/workspace. Do not treat the VM dev server as the canonical deployed app.

${tracking}

User dashboard improvement request:
${request}

General rules:
- Work with the existing Next.js / Supabase / sidecar architecture.
- Keep edits focused and reviewable.
- Never run destructive git commands such as reset --hard or checkout -- unless explicitly requested.
- Run pnpm typecheck for code changes. Run pnpm build before a production-affecting push/deploy.
- When you modify production, commit and push so Vercel deploys the live app.
- Summarize changed files, checks run, deployment or preview URLs, and blockers.`;

  if (mode === "clarify") {
    return `${shared}

Mode: CLARIFY.
Preview policy for the eventual implementation: ${sandboxPreview ? "sandbox preview before production" : "direct production apply after clarification"}.
Inspect the repo enough to ask precise questions, but do not edit files, run formatters, commit, push, or deploy. Ask only the questions needed to make the implementation decision-complete.`;
  }

  if (sandboxPreview) {
    return `${shared}

Mode: DIRECT APPLY, WITH SANDBOX PREVIEW FIRST.
Do not change the main checkout. Create an isolated git worktree under /home/thomasjiralerspong/eps-dashboard-runs/${runId}. Implement there, start a preview server on an available 31xx port bound to 0.0.0.0, and report both:
- Production: ${productionUrl}
- Preview: http://35.226.138.62:<port>

When the preview is ready, set the run status to awaiting_approval and stop. Do not commit, push, or deploy production until the user explicitly approves.`;
  }

  return `${shared}

Mode: DIRECT APPLY.
Handle this end to end without stopping at a plan unless you hit a real blocker. Implement in the main checkout, run checks, commit, push to the Vercel-connected branch, and report the resulting Vercel production/deployment status.`;
}

function isImprovementSession(session: Session) {
  return session.title?.startsWith("Dashboard improvement:") ?? false;
}

function visibleForKind(sessions: Session[], kind: ThreadKind) {
  return sessions.filter((session) =>
    kind === "improve" ? isImprovementSession(session) : !isImprovementSession(session),
  );
}

function fmtRelative(d: string | null): string {
  if (!d) return "new";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function buildLiveFromDb(rows: DbMessage[]): Msg[] {
  const out: Msg[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({ id: r.id, role: "user", text: r.body, authorEmail: r.userEmail });
      continue;
    }
    if (r.role !== "assistant") continue;
    const blocks: Block[] = [];
    const tc = r.toolCallJson as { tools?: ToolBlock[]; thinking?: string } | null;
    if (tc?.thinking) blocks.push({ kind: "thinking", text: tc.thinking });
    if (tc?.tools && Array.isArray(tc.tools)) {
      for (const t of tc.tools) blocks.push(t);
    }
    if (r.body) blocks.push({ kind: "text", text: r.body });
    if (blocks.length > 0) out.push({ id: r.id, role: "assistant", blocks });
  }
  return out;
}

function sidecarMessages(history: Msg[], nextUserText: string) {
  const recent = history.slice(-12).flatMap((m) => {
    if (m.role === "user") return [{ role: "user", content: m.text }];
    const content = m.blocks
      .filter((b): b is TextBlock => b.kind === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return content ? [{ role: "assistant", content }] : [];
  });
  return [...recent, { role: "user", content: nextUserText }];
}

export function ClaudeThread({
  kind,
  storageKey,
  placeholder,
  emptyTitle,
  emptyBody,
  className = "",
}: ClaudeThreadProps) {
  const [draft, setDraft] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSid, setActiveSid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadedSessions, setLoadedSessions] = useState(false);
  const [loadedMessages, setLoadedMessages] = useState(false);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentRunMode>("direct_apply");
  const [agentProvider, setAgentProvider] = useState<AgentRunProvider>("claude_code");
  const [sandboxPreview, setSandboxPreview] = useState(false);
  const skipNextLoadRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleSessions = visibleForKind(sessions, kind);
  const activeSession = visibleSessions.find((s) => s.id === activeSid) ?? null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/conversations");
      if (!r.ok) {
        if (!cancelled) setLoadedSessions(true);
        return;
      }
      const j = (await r.json()) as { sessions: Session[] };
      if (cancelled) return;
      setSessions(j.sessions);
      setLoadedSessions(true);

      let remembered: string | null = null;
      try {
        remembered = window.localStorage.getItem(storageKey);
      } catch {}
      const visible = visibleForKind(j.sessions, kind);
      const nextSid =
        (remembered && visible.some((s) => s.id === remembered) && remembered) ||
        visible[0]?.id ||
        null;
      setActiveSid(nextSid);
      if (!nextSid) setLoadedMessages(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, storageKey]);

  useEffect(() => {
    let cancelled = false;
    if (!activeSid) {
      setMessages([]);
      setLoadedMessages(true);
      return;
    }
    try {
      window.localStorage.setItem(storageKey, activeSid);
    } catch {}
    if (skipNextLoadRef.current === activeSid) {
      skipNextLoadRef.current = null;
      setLoadedMessages(true);
      return;
    }
    setLoadedMessages(false);
    setMessages([]);
    (async () => {
      const r = await fetch(`/api/conversations/${activeSid}/messages`);
      if (!r.ok) {
        if (!cancelled) setLoadedMessages(true);
        return;
      }
      const j = (await r.json()) as { messages: DbMessage[] };
      if (!cancelled) {
        setMessages(buildLiveFromDb(j.messages));
        setLoadedMessages(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSid, storageKey]);

  async function createSession(title?: string, skipInitialLoad = false): Promise<Session | null> {
    setCreating(true);
    try {
      const r = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(title ? { title } : {}),
      });
      if (!r.ok) {
        alert(`Failed to start conversation: ${await r.text()}`);
        return null;
      }
      const j = (await r.json()) as { session: Session };
      setSessions((s) => [j.session, ...s]);
      if (skipInitialLoad) skipNextLoadRef.current = j.session.id;
      setActiveSid(j.session.id);
      return j.session;
    } finally {
      setCreating(false);
    }
  }

  async function createAgentRun(
    mode: AgentRunMode,
    provider: AgentRunProvider,
    previewFirst: boolean,
    request: string,
    chatSessionId: string,
  ): Promise<AgentRun | null> {
    const r = await fetch("/api/agent-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, provider, sandboxPreview: previewFirst, request, chatSessionId }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { run: AgentRun };
    return j.run;
  }

  async function patchAgentRun(
    runId: string,
    body: {
      status?: AgentRunStatus;
      summary?: string | null;
      lastError?: string | null;
      event?: { type: string; body?: string | null; metadata?: Record<string, unknown> };
    },
  ) {
    await fetch(`/api/agent-runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function startFresh() {
    setActiveSid(null);
    setMessages([]);
    setLoadedMessages(true);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  }

  async function persistUser(sessionId: string, text: string) {
    await fetch(`/api/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", body: text }),
    });
  }

  async function persistAssistant(sessionId: string, blocks: Block[]) {
    const tools = blocks.filter((b): b is ToolBlock => b.kind === "tool");
    const thinking = blocks
      .filter((b): b is ThinkingBlock => b.kind === "thinking")
      .map((b) => b.text)
      .join("");
    const text = blocks
      .filter((b): b is TextBlock => b.kind === "text")
      .map((b) => b.text)
      .join("");
    await fetch(`/api/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "assistant",
        body: text,
        toolCallJson: tools.length || thinking ? { tools, thinking } : null,
      }),
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    let runForRequest: AgentRun | null = null;
    const agentModeForRequest = agentMode;
    const agentProviderForRequest = agentProvider;
    const sandboxPreviewForRequest = sandboxPreview;

    let session = activeSession;
    if (!session) {
      const title =
        kind === "improve"
          ? `Dashboard improvement: ${text.slice(0, 56)}`
          : text.slice(0, 80);
      session = await createSession(title, true);
      if (!session) return;
    }

    const history = messages;
    setDraft("");

    const userMsg: Msg = {
      id: makeClientId("msg"),
      role: "user",
      text,
      authorEmail: session.lastUserEmail,
    };
    const assistantId = makeClientId("msg");
    const assistantMsg: Msg = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      startupPhase: "spawning",
      startedAt: Date.now(),
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setPending(true);

    const updateAssistant = (fn: (msg: Extract<Msg, { role: "assistant" }>) => void) => {
      setMessages((m) =>
        m.map((msg) => {
          if (msg.id !== assistantId || msg.role !== "assistant") return msg;
          const copy: Extract<Msg, { role: "assistant" }> = {
            ...msg,
            blocks: [...msg.blocks],
          };
          fn(copy);
          return copy;
        }),
      );
    };

    try {
      await persistUser(session.id, text);
      if (kind === "improve") {
        runForRequest = await createAgentRun(
          agentModeForRequest,
          agentProviderForRequest,
          sandboxPreviewForRequest,
          text,
          session.id,
        );
        if (!runForRequest) {
          updateAssistant((m) => {
            m.blocks.push({
              kind: "text",
              text: "_Run tracking could not be created; dispatching the agent without a run record._\n\n",
            });
          });
        }
      }

      const tokRes = await fetch("/api/chat-token", { method: "POST" });
      if (!tokRes.ok) {
        const errTxt = await tokRes.text().catch(() => tokRes.statusText);
        if (runForRequest) {
          void patchAgentRun(runForRequest.id, {
            status: "failed",
            lastError: errTxt || tokRes.statusText,
            event: { type: "failed", body: "Could not mint sidecar token." },
          });
        }
        updateAssistant((m) => {
          m.blocks.push({ kind: "text", text: `Auth: ${errTxt || tokRes.statusText}` });
        });
        return;
      }
      const { token, sidecar_url: sidecarUrl } = (await tokRes.json()) as {
        token: string;
        sidecar_url: string;
      };
      const sidecarSessionId =
        kind === "improve"
          ? `dashboard-improve-${session.id.replace(/-/g, "").slice(0, 16)}`
          : session.agentHandle ??
            `dashboard-${kind}-${session.id.replace(/-/g, "").slice(0, 16)}`;
      const agentText =
        kind === "improve"
          ? improvementDispatchPrompt(
              text,
              agentModeForRequest,
              sandboxPreviewForRequest,
              agentProviderForRequest,
              runForRequest,
            )
          : text;
      const res = await postSidecarChat(sidecarUrl, token, {
        session_id: sidecarSessionId,
        provider: agentProviderForRequest,
        messages: sidecarMessages(history, agentText),
      });
      if (!res.ok || !res.body) {
        const errTxt = await res.text().catch(() => res.statusText);
        if (runForRequest) {
          void patchAgentRun(runForRequest.id, {
            status: "failed",
            lastError: errTxt || res.statusText,
            event: { type: "failed", body: "Sidecar request failed before streaming." },
          });
        }
        updateAssistant((m) => {
          m.blocks.push({ kind: "text", text: errTxt || res.statusText });
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split(/\r?\n\r?\n/);
        buf = events.pop() ?? "";
        for (const ev of events) {
          if (!ev.trim()) continue;
          const lines = ev.split(/\r?\n/);
          let eventName = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventName === "starting") {
            const phase = (data.phase as string) ?? "spawning";
            updateAssistant((m) => {
              m.startupPhase = phase === "warm" ? null : (phase as StartupPhase);
            });
          } else if (eventName === "ready") {
            updateAssistant((m) => {
              m.startupPhase = "ready";
            });
          } else if (eventName === "token") {
            const t = (data.text as string) ?? "";
            updateAssistant((m) => {
              m.startupPhase = null;
              const last = m.blocks[m.blocks.length - 1];
              if (last && last.kind === "text") last.text += t;
              else m.blocks.push({ kind: "text", text: t });
            });
          } else if (eventName === "thinking") {
            const t = (data.text as string) ?? "";
            updateAssistant((m) => {
              const last = m.blocks[m.blocks.length - 1];
              if (last && last.kind === "thinking") last.text += t;
              else m.blocks.push({ kind: "thinking", text: t });
            });
          } else if (eventName === "tool_use") {
            updateAssistant((m) => {
              m.blocks.push({
                kind: "tool",
                id: (data.id as string) ?? makeClientId("tool"),
                name: (data.name as string) ?? "?",
                input: (data.input as Record<string, unknown>) ?? {},
              });
            });
          } else if (eventName === "tool_result") {
            const matchId = (data.tool_use_id as string) ?? (data.name as string) ?? "";
            updateAssistant((m) => {
              for (let i = m.blocks.length - 1; i >= 0; i--) {
                const b = m.blocks[i];
                if (b.kind === "tool" && b.id === matchId && b.ok === undefined) {
                  m.blocks[i] = {
                    ...b,
                    ok: data.ok as boolean,
                    result: (data.content as string) ?? "",
                  };
                  break;
                }
              }
            });
          } else if (eventName === "done") {
            updateAssistant((m) => {
              if (typeof data.cost_usd === "number") m.cost = data.cost_usd;
              if (typeof data.duration_ms === "number") m.durationMs = data.duration_ms;
            });
            setMessages((all) => {
              const final = all.find(
                (msg) => msg.id === assistantId && msg.role === "assistant",
              ) as Extract<Msg, { role: "assistant" }> | undefined;
              if (final) {
                const finalText = final.blocks
                  .filter((b): b is TextBlock => b.kind === "text")
                  .map((b) => b.text)
                  .join("")
                  .trim();
                void persistAssistant(session.id, final.blocks);
                if (runForRequest) {
                  void patchAgentRun(runForRequest.id, {
                    status:
                      agentModeForRequest === "direct_apply" && sandboxPreviewForRequest
                        ? "awaiting_approval"
                        : "completed",
                    summary: finalText || null,
                    event: {
                      type:
                        agentModeForRequest === "direct_apply" && sandboxPreviewForRequest
                          ? "awaiting_approval"
                          : "completed",
                      body:
                        agentModeForRequest === "direct_apply" && sandboxPreviewForRequest
                          ? "Sandbox agent finished and is awaiting approval."
                          : "Agent stream finished.",
                    },
                  });
                }
              }
              return all;
            });
            setSessions((all) =>
              all.map((s) =>
                s.id === session.id
                  ? {
                      ...s,
                      messageCount: s.messageCount + 2,
                      lastMessageAt: new Date().toISOString(),
                    }
                  : s,
              ),
            );
          } else if (eventName === "error") {
            if (runForRequest) {
              void patchAgentRun(runForRequest.id, {
                status: "failed",
                lastError: String(data.message ?? "error"),
                event: { type: "error", body: String(data.message ?? "error") },
              });
            }
            updateAssistant((m) => {
              m.blocks.push({ kind: "text", text: `\n\n_${data.message ?? "error"}_` });
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (runForRequest) {
        void patchAgentRun(runForRequest.id, {
          status: "failed",
          lastError: msg,
          event: { type: "failed", body: msg },
        });
      }
      updateAssistant((m) => {
        m.blocks.push({ kind: "text", text: `\n\n${msg}` });
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-subtle/30 px-3 py-2 text-[11px]">
        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-muted" />
        <select
          value={activeSid ?? ""}
          onChange={(e) => setActiveSid(e.target.value || null)}
          disabled={!loadedSessions || visibleSessions.length === 0}
          className="min-w-0 flex-1 rounded border border-border bg-panel px-1.5 py-1 text-[11px] focus:border-running focus:outline-none disabled:opacity-50"
        >
          {!loadedSessions && <option value="">Loading conversations...</option>}
          {loadedSessions && visibleSessions.length === 0 && (
            <option value="">No saved conversations</option>
          )}
          {visibleSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || "Dashboard chat"} - {fmtRelative(s.lastMessageAt ?? s.createdAt)} -{" "}
              {s.messageCount}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => (kind === "improve" ? startFresh() : void createSession())}
          disabled={creating}
          title="Start a new conversation"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-panel px-2 py-1 text-muted transition-colors hover:bg-border hover:text-fg disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 text-[12.5px]">
        {!loadedSessions || !loadedMessages ? (
          <p className="text-muted">Loading...</p>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-subtle p-3 text-muted">
            <p className="font-medium text-fg">{emptyTitle}</p>
            <p className="mt-1.5 leading-relaxed">{emptyBody}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <span>{m.role === "user" ? m.authorEmail ?? "You" : "Claude"}</span>
                  {m.role === "assistant" && (m.cost != null || m.durationMs != null) && (
                    <span className="font-mono normal-case tracking-normal">
                      {m.durationMs != null && `${(m.durationMs / 1000).toFixed(1)}s`}
                      {m.cost != null && m.durationMs != null && " - "}
                      {m.cost != null && `$${m.cost.toFixed(2)}`}
                    </span>
                  )}
                </div>
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap rounded-md bg-subtle p-2.5 text-fg">
                    {m.text}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {m.startupPhase && m.startupPhase !== "ready" && m.blocks.length === 0 && (
                      <StartupPill
                        phase={m.startupPhase}
                        startedAt={m.startedAt ?? Date.now()}
                      />
                    )}
                    {m.blocks.length === 0 && m.startupPhase === "ready" && (
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted" />
                    )}
                    {m.blocks.map((block, i) =>
                      block.kind === "text" ? (
                        <div key={i} className="prose-tight text-fg">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) =>
                                href && href.startsWith("/") ? (
                                  <a href={href}>{children}</a>
                                ) : (
                                  <a href={href} target="_blank" rel="noopener noreferrer">
                                    {children}
                                  </a>
                                ),
                            }}
                          >
                            {block.text}
                          </ReactMarkdown>
                        </div>
                      ) : block.kind === "thinking" ? (
                        <div
                          key={i}
                          className="rounded-md border border-dashed border-border bg-subtle/60 p-2 text-[11px] italic text-muted"
                        >
                          {block.text}
                        </div>
                      ) : (
                        <ToolCard key={i} block={block} />
                      ),
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {kind === "improve" && (
        <div className="shrink-0 border-t border-border bg-panel px-3 py-2">
          <div className="grid grid-cols-2 gap-1">
            {AGENT_RUN_MODES.map((mode) => {
              const active = agentMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAgentMode(mode)}
                  disabled={pending || creating}
                  title={AGENT_RUN_MODE_HELP[mode]}
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? "border-fg bg-fg text-canvas"
                      : "border-border bg-subtle text-muted hover:bg-border hover:text-fg"
                  }`}
                >
                  {AGENT_RUN_MODE_LABEL[mode]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSandboxPreview((v) => !v)}
            disabled={pending || creating}
            className={`mt-1.5 flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              sandboxPreview
                ? "border-running bg-running/10 text-fg"
                : "border-border bg-subtle text-muted hover:bg-border hover:text-fg"
            }`}
          >
            <span>Sandbox preview</span>
            <span className="font-mono text-[10px]">{sandboxPreview ? "on" : "off"}</span>
          </button>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {AGENT_RUN_PROVIDERS.map((provider) => {
              const active = agentProvider === provider;
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setAgentProvider(provider)}
                  disabled={pending || creating}
                  title={AGENT_RUN_PROVIDER_HELP[provider]}
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? "border-fg bg-fg text-canvas"
                      : "border-border bg-subtle text-muted hover:bg-border hover:text-fg"
                  }`}
                >
                  {AGENT_RUN_PROVIDER_LABEL[provider]}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted">
            {AGENT_RUN_MODE_HELP[agentMode]} {AGENT_RUN_PROVIDER_HELP[agentProvider]}{" "}
            {sandboxPreview
              ? "Implementation requests use a preview worktree before production."
              : "Implementation requests target production directly."}
          </p>
        </div>
      )}

      <form className="flex items-end gap-2 border-t border-border p-3" onSubmit={send}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder={placeholder}
          rows={2}
          disabled={pending || creating}
          className="flex-1 resize-none rounded-md border border-border bg-subtle px-2.5 py-1.5 text-[13px] text-fg placeholder:text-muted focus:border-running focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || creating || !draft.trim()}
          className="rounded-md border border-border bg-fg p-2 text-canvas transition-colors disabled:opacity-30"
          aria-label={kind === "improve" ? "Dispatch improvement" : "Send"}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function StartupPill({ phase, startedAt }: { phase: StartupPhase; startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100);
    return () => clearInterval(id);
  }, [startedAt]);
  const label = phase === "spawning" ? "Spawning agent..." : "Loading tools, MCP servers, memory...";
  return (
    <div className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-subtle px-2 py-1 text-[11px] text-muted">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-running" />
      <span>{label}</span>
      <span className="font-mono text-[10px]">{elapsed.toFixed(1)}s</span>
    </div>
  );
}

function ToolCard({ block }: { block: ToolBlock }) {
  const [expanded, setExpanded] = useState(false);
  const summary = formatToolInput(block.name, block.input);

  const statusIcon =
    block.ok === undefined ? (
      <Wrench className="h-3 w-3 animate-pulse text-muted" />
    ) : block.ok ? (
      <Check className="h-3 w-3 text-confidence-high" />
    ) : (
      <XIcon className="h-3 w-3 text-red-600" />
    );

  return (
    <div className="rounded-md border border-border bg-subtle/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left"
      >
        <span className="mt-0.5 shrink-0">{statusIcon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {block.name}
            </span>
          </div>
          <div className="truncate font-mono text-[11px] text-fg">{summary}</div>
        </div>
        {block.result && (
          <ChevronDown
            className={`mt-1 h-3 w-3 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {expanded && block.result && (
        <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words border-t border-border bg-panel p-2 font-mono text-[11px] text-fg">
          {block.result}
        </pre>
      )}
    </div>
  );
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
  if (name === "Bash") return String(input.command ?? "");
  if (name === "Read") return String(input.file_path ?? "");
  if (name === "Edit" || name === "Write") return String(input.file_path ?? "");
  if (name === "Grep") return `${input.pattern ?? ""} ${input.path ? `- ${input.path}` : ""}`.trim();
  if (name === "Glob") return String(input.pattern ?? "");
  if (name === "WebFetch") return String(input.url ?? "");
  if (name === "WebSearch") return String(input.query ?? "");
  if (name === "Task") return String(input.description ?? input.subagent_type ?? "");
  const json = JSON.stringify(input);
  return json.length > 120 ? json.slice(0, 120) + "..." : json;
}

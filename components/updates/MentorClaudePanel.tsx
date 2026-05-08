"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { postSidecarChat } from "@/lib/sidecar-client";
import { cn } from "@/lib/utils";

export type ClaudeAskPayload = {
  scopeTitle: string;
  contextMd: string;
  suggestedQuestion: string;
  initialQuestion?: string;
  autoSubmit?: boolean;
};

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; pending?: boolean };

const ASK_EVENT = "eps:mentor-claude:ask";

export function ClaudeAskButton({
  payload,
  label = "Ask Claude Code",
  compact = false,
  className,
}: {
  payload: ClaudeAskPayload;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent<ClaudeAskPayload>(ASK_EVENT, { detail: payload }));
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-2 py-1 text-[11px] text-muted transition-colors hover:bg-raised hover:text-fg",
        compact && "h-7 w-7 justify-center px-0 py-0",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {!compact && <span>{label}</span>}
    </button>
  );
}

export function ClaudeAskComposer({
  payload,
  placeholder = "Ask Claude Code to inspect these results...",
  className,
}: {
  payload: ClaudeAskPayload;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    window.dispatchEvent(
      new CustomEvent<ClaudeAskPayload>(ASK_EVENT, {
        detail: {
          ...payload,
          suggestedQuestion: text,
          initialQuestion: text,
          autoSubmit: true,
        },
      }),
    );
    setDraft("");
  }

  return (
    <form
      onSubmit={submit}
      className={cn("rounded-lg border border-border bg-panel p-3", className)}
    >
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="min-h-[52px] flex-1 resize-none rounded-md border border-border bg-canvas px-3 py-2 text-[13px] leading-relaxed text-fg placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="grid h-[52px] w-11 place-items-center rounded-md bg-fg text-canvas disabled:opacity-40"
          aria-label="Ask Claude Code"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

export function MentorClaudePanel({
  sessionId,
  baseContextMd,
}: {
  sessionId: string;
  baseContextMd: string;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ClaudeAskPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const defaultScope = useMemo<ClaudeAskPayload>(() => ({
    scopeTitle: "Daily update",
    contextMd: baseContextMd,
    suggestedQuestion: "What are the main takeaways from this update?",
  }), [baseContextMd]);

  const activeScope = scope ?? defaultScope;

  const buildPromptContext = useCallback((focusScope: ClaudeAskPayload) => {
    return [
      "You are Claude Code answering a research mentor reading EPS results.",
      "Use your VM tools when needed. Do not rely only on this prompt.",
      "Inspect the dashboard database with psql, the local repo, GitHub issues, and artifact URLs when the question requires it.",
      "If result artifacts need inspection, use shell tools such as curl, git, rg, and psql to locate or download them.",
      "Answer concisely and cite the specific result, claim id, issue number, file, or artifact you inspected.",
      "",
      "Update context:",
      baseContextMd,
      "",
      "Current focus:",
      focusScope.contextMd,
    ].join("\n");
  }, [baseContextMd]);

  const sendText = useCallback(async (rawText: string, focusScope: ClaudeAskPayload = activeScope) => {
    const text = rawText.trim();
    if (!text || pending) return;

    setDraft("");
    setScope(focusScope);
    setOpen(true);
    setPending(true);
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "assistant", text: "Starting Claude Code...", pending: true },
    ]);

    const updateAssistant = (append: string, done = false) => {
      setMessages((m) => {
        const next = [...m];
        for (let i = next.length - 1; i >= 0; i--) {
          const msg = next[i];
          if (msg.role === "assistant") {
            next[i] = {
              ...msg,
              text: msg.text + append,
              pending: done ? false : msg.pending,
            };
            break;
          }
        }
        return next;
      });
    };

    try {
      const tokenRes = await fetch("/api/chat-token", { method: "POST" });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "");
        updateAssistant(
          `Claude is available after sign-in. ${body || tokenRes.statusText}`,
          true,
        );
        return;
      }

      const { token, sidecar_url: sidecarUrl } = (await tokenRes.json()) as {
        token: string;
        sidecar_url: string;
      };

      const res = await postSidecarChat(sidecarUrl, token, {
        session_id: `mentor-update-${sessionId}`,
        provider: "claude_code",
        messages: [
          {
            role: "user",
            content: `${buildPromptContext(focusScope)}\n\nMentor question:\n${text}`,
          },
        ],
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        updateAssistant(body || res.statusText, true);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          const lines = eventText.split(/\r?\n/);
          let eventName = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventName === "starting") {
            const phase = String(data.phase ?? "starting");
            updateAssistant(`\n[${phase}]`);
          } else if (eventName === "ready") {
            updateAssistant("\n[ready]\n\n");
          } else if (eventName === "token") {
            updateAssistant(String(data.text ?? ""));
          } else if (eventName === "tool_use") {
            updateAssistant(`\n\n[tool: ${String(data.name ?? "tool")}]\n`);
          } else if (eventName === "done") {
            updateAssistant("", true);
          } else if (eventName === "error") {
            updateAssistant(`\n\n${String(data.message ?? "Claude failed.")}`, true);
          }
        }
      }
    } catch (error) {
      updateAssistant(error instanceof Error ? error.message : String(error), true);
    } finally {
      setPending(false);
      setMessages((m) =>
        m.map((msg, index) =>
          index === m.length - 1 && msg.role === "assistant"
            ? { ...msg, pending: false }
            : msg,
        ),
      );
    }
  }, [activeScope, buildPromptContext, pending, sessionId]);

  useEffect(() => {
    function onAsk(event: Event) {
      const detail = (event as CustomEvent<ClaudeAskPayload>).detail;
      const text = detail.initialQuestion ?? detail.suggestedQuestion;
      setScope(detail);
      setDraft(detail.autoSubmit ? "" : text);
      setOpen(true);
      if (detail.autoSubmit) void sendText(text, detail);
    }
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [sendText]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  function send(e?: React.FormEvent) {
    e?.preventDefault();
    void sendText(draft);
  }

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-end md:inset-x-auto md:right-4">
      <aside className="pointer-events-auto flex max-h-[min(72dvh,680px)] w-full max-w-[560px] flex-col rounded-lg border border-border bg-panel shadow-rail">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <MessageCircle className="mt-0.5 h-4 w-4 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-fg">Claude Code</div>
            <div className="mt-0.5 truncate text-[11px] text-muted">{activeScope.scopeTitle}</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted hover:bg-subtle hover:text-fg"
            aria-label="Close Claude chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="rounded-md border border-border bg-subtle p-3 text-[12px] leading-relaxed text-muted">
              Ask a question about this result or update.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message, index) => (
                <div key={index} className="text-[13px]">
                  <div className="mb-1 text-[10px] font-medium text-muted">
                    {message.role === "user" ? "Mentor" : "Claude"}
                  </div>
                  <div
                    className={cn(
                      "whitespace-pre-wrap rounded-md border px-3 py-2 leading-relaxed",
                      message.role === "user"
                        ? "border-border bg-subtle text-fg"
                        : "border-border bg-panel text-fg-soft",
                    )}
                  >
                    {message.text}
                    {message.role === "assistant" && message.pending && (
                      <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-muted" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            disabled={pending}
            placeholder="Ask about the result..."
            className="min-h-[44px] flex-1 resize-none rounded-md border border-border bg-subtle px-3 py-2 text-[13px] text-fg placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="grid h-10 w-10 place-items-center rounded-md bg-fg text-canvas disabled:opacity-40"
            aria-label="Send question"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </aside>
    </div>
  );
}

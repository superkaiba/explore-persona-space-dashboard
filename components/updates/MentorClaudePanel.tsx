"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { postSidecarChat } from "@/lib/sidecar-client";
import { cn } from "@/lib/utils";

export type ClaudeAskPayload = {
  scopeTitle: string;
  contextMd: string;
  suggestedQuestion: string;
};

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; pending?: boolean };

const ASK_EVENT = "eps:mentor-claude:ask";

export function ClaudeAskButton({
  payload,
  label = "Ask Claude",
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

  useEffect(() => {
    function onAsk(event: Event) {
      const detail = (event as CustomEvent<ClaudeAskPayload>).detail;
      setScope(detail);
      setDraft(detail.suggestedQuestion);
      setOpen(true);
    }
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const activeScope = scope ?? {
    scopeTitle: "Daily update",
    contextMd: baseContextMd,
    suggestedQuestion: "What are the main takeaways from this update?",
  };

  const promptContext = useMemo(() => {
    return [
      "You are answering a research mentor reading the EPS daily update.",
      "Be concise, specific, and clear. If the provided result context is insufficient, say what is missing.",
      "Do not discuss dashboard implementation unless asked.",
      "",
      "Daily update context:",
      baseContextMd,
      "",
      "Current focus:",
      activeScope.contextMd,
    ].join("\n");
  }, [activeScope.contextMd, baseContextMd]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    setDraft("");
    setPending(true);
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "assistant", text: "", pending: true },
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
            content: `${promptContext}\n\nMentor question:\n${text}`,
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

          if (eventName === "token") {
            updateAssistant(String(data.text ?? ""));
          } else if (eventName === "tool_use") {
            updateAssistant(`\n\n[checking ${String(data.name ?? "tool")}]\n`);
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
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-3 md:items-stretch md:p-4">
      <aside className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[520px] flex-col rounded-lg border border-border bg-panel shadow-rail md:max-h-none">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <MessageCircle className="mt-0.5 h-4 w-4 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-fg">Claude</div>
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
              Ask a question about this result or the daily update.
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

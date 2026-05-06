"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, ChevronLeft, Send, Sparkles, Wrench } from "lucide-react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: { name: string; ok?: boolean }[];
};

const STARTER = "Ask about a claim, experiment, or the whole project…";

export function ChatRail() {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    const assistantMsg: Msg = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "",
      toolCalls: [],
    };
    const next = [...messages, userMsg, assistantMsg];
    setMessages(next);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(({ role, text }) => ({ role, content: text })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => res.statusText);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantMsg.id ? { ...msg, text: `❌ ${err || res.statusText}` } : msg,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          if (!ev.trim()) continue;
          const lines = ev.split("\n");
          let eventName = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;
            if (eventName === "token") {
              const t = (data.text as string) ?? "";
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id ? { ...msg, text: msg.text + t } : msg,
                ),
              );
            } else if (eventName === "tool_use") {
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id
                    ? {
                        ...msg,
                        toolCalls: [
                          ...(msg.toolCalls ?? []),
                          { name: data.name as string, ok: undefined },
                        ],
                      }
                    : msg,
                ),
              );
            } else if (eventName === "tool_result") {
              setMessages((m) =>
                m.map((msg) => {
                  if (msg.id !== assistantMsg.id) return msg;
                  const calls = msg.toolCalls ?? [];
                  // Mark the most recent matching call as ok/error.
                  for (let i = calls.length - 1; i >= 0; i--) {
                    if (calls[i].name === data.name && calls[i].ok === undefined) {
                      const next = [...calls];
                      next[i] = { ...next[i], ok: data.ok as boolean };
                      return { ...msg, toolCalls: next };
                    }
                  }
                  return msg;
                }),
              );
            } else if (eventName === "error") {
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id
                    ? { ...msg, text: msg.text + `\n\n_❌ ${data.message}_` }
                    : msg,
                ),
              );
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) =>
        m.map((message) =>
          message.id === assistantMsg.id ? { ...message, text: `❌ ${msg}` } : message,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <aside
      className="flex h-full flex-col border-l border-border bg-panel transition-[width] duration-200"
      style={{ width: open ? 380 : 44 }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        {open && (
          <div className="flex items-center gap-2 text-[13px] font-medium tracking-tight">
            <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
              <Sparkles className="h-3 w-3" />
            </span>
            <span>Claude</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-1 text-muted transition-colors hover:bg-subtle hover:text-fg"
          aria-label={open ? "Collapse chat" : "Expand chat"}
        >
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 text-[12.5px]">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-subtle p-3 text-muted">
                <p className="font-medium text-fg">Ask anything about your research.</p>
                <p className="mt-1.5 leading-relaxed">
                  I can search claims, fetch full bodies, and surface what is
                  in-progress. Try:{" "}
                  <em>&ldquo;Latest finding on EM and persona collapse?&rdquo;</em>
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m) => (
                  <li key={m.id} className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {m.role === "user" ? "You" : "Claude"}
                    </div>
                    {m.role === "user" ? (
                      <div className="whitespace-pre-wrap rounded-md bg-subtle p-2.5 text-fg">
                        {m.text}
                      </div>
                    ) : (
                      <div className="prose-tight text-fg">
                        {m.toolCalls && m.toolCalls.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {m.toolCalls.map((tc, i) => (
                              <span
                                key={i}
                                className={[
                                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                                  tc.ok === undefined
                                    ? "border-border bg-subtle text-muted"
                                    : tc.ok
                                      ? "border-confidence-high/30 bg-confidence-high/10 text-confidence-high"
                                      : "border-red-300 bg-red-50 text-red-700",
                                ].join(" ")}
                              >
                                <Wrench className="h-2.5 w-2.5" />
                                {tc.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.text ? (
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
                            {m.text}
                          </ReactMarkdown>
                        ) : (
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted" />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={send}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e as unknown as React.FormEvent);
                }
              }}
              placeholder={STARTER}
              rows={2}
              disabled={pending}
              className="flex-1 resize-none rounded-md border border-border bg-subtle px-2.5 py-1.5 text-[13px] text-fg placeholder:text-muted focus:border-running focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="rounded-md border border-border bg-fg p-2 text-canvas transition-colors disabled:opacity-30"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </>
      )}
    </aside>
  );
}

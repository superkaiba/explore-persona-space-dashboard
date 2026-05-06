"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRight,
  ChevronLeft,
  Send,
  Sparkles,
  Wrench,
  Check,
  X as XIcon,
  ChevronDown,
} from "lucide-react";

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

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; blocks: Block[]; cost?: number; durationMs?: number };

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
    const assistantId = crypto.randomUUID();
    const assistantMsg: Msg = { id: assistantId, role: "assistant", blocks: [] };
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
      const res = await fetch("/api/chat-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.filter((m) => m.role === "user").map((m) => ({
              role: "user",
              content: (m as Extract<Msg, { role: "user" }>).text,
            })),
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok || !res.body) {
        const errTxt = await res.text().catch(() => res.statusText);
        updateAssistant((m) => {
          m.blocks.push({ kind: "text", text: `❌ ${errTxt || res.statusText}` });
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
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventName === "token") {
            const t = (data.text as string) ?? "";
            updateAssistant((m) => {
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
                id: (data.id as string) ?? crypto.randomUUID(),
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
          } else if (eventName === "error") {
            updateAssistant((m) => {
              m.blocks.push({ kind: "text", text: `\n\n_❌ ${data.message ?? "error"}_` });
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateAssistant((m) => {
        m.blocks.push({ kind: "text", text: `\n\n❌ ${msg}` });
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <aside
      className="flex h-full flex-col border-l border-border bg-panel transition-[width] duration-200"
      style={{ width: open ? 440 : 44 }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        {open && (
          <div className="flex items-center gap-2 text-[13px] font-medium tracking-tight">
            <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
              <Sparkles className="h-3 w-3" />
            </span>
            <span>Claude</span>
            <span className="rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-running">
              opus 4.7
            </span>
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
                <p className="font-medium text-fg">Real Claude Code session.</p>
                <p className="mt-1.5 leading-relaxed">
                  Full toolkit: shell, file read/write, MCP servers, custom subagents,
                  skills. Knows your CLAUDE.md and memory. Try{" "}
                  <em>&ldquo;What is the latest finding on EM and persona collapse?&rdquo;</em>
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((m) => (
                  <li key={m.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider text-muted">
                      <span>{m.role === "user" ? "You" : "Claude"}</span>
                      {m.role === "assistant" && (m.cost != null || m.durationMs != null) && (
                        <span className="font-mono normal-case tracking-normal">
                          {m.durationMs != null && `${(m.durationMs / 1000).toFixed(1)}s`}
                          {m.cost != null && m.durationMs != null && " · "}
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
                        {m.blocks.length === 0 && (
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
  if (name === "Grep") return `${input.pattern ?? ""} ${input.path ? `· ${input.path}` : ""}`.trim();
  if (name === "Glob") return String(input.pattern ?? "");
  if (name === "WebFetch") return String(input.url ?? "");
  if (name === "WebSearch") return String(input.query ?? "");
  if (name === "Task") return String(input.description ?? input.subagent_type ?? "");
  // Fallback: short JSON
  const json = JSON.stringify(input);
  return json.length > 120 ? json.slice(0, 120) + "…" : json;
}

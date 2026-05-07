"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Sparkles, Wrench, Check, X as XIcon, ChevronDown } from "lucide-react";

type DbMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  body: string;
  toolCallJson: Record<string, unknown> | null;
  userId: string | null;
  userEmail: string | null;
  createdAt: string;
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
type Block = TextBlock | ToolBlock;

type LiveMsg =
  | { id: string; role: "user"; text: string; authorEmail: string | null }
  | { id: string; role: "assistant"; blocks: Block[] };

type Props = {
  claimId: string;
  claimTitle: string;
  sessionId: string;
  currentUserEmail: string | null;
};

const SIDECAR_CONTEXT_PREAMBLE = (claimId: string, title: string) =>
  `(Context: discussing dashboard claim "${title}" (id ${claimId}). The full markdown body is in the dashboard at /claim/${claimId}; you can read it via the Bash tool by querying the project's Postgres or by reading the body via the dashboard's API.)`;

function buildLiveFromDb(rows: DbMessage[]): LiveMsg[] {
  const out: LiveMsg[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({ id: r.id, role: "user", text: r.body, authorEmail: r.userEmail });
    } else if (r.role === "assistant") {
      const blocks: Block[] = [];
      // Reconstruct tool blocks from saved tool_call_json + body chunks.
      const tc = r.toolCallJson as
        | { tools?: ToolBlock[]; text?: string }
        | null;
      if (tc?.tools && Array.isArray(tc.tools)) {
        for (const t of tc.tools) blocks.push(t);
      }
      if (r.body) blocks.push({ kind: "text", text: r.body });
      out.push({ id: r.id, role: "assistant", blocks });
    }
  }
  return out;
}

export function ConversationView({ claimId, claimTitle, sessionId, currentUserEmail }: Props) {
  const [messages, setMessages] = useState<LiveMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidecarUrlRef = useRef<string | null>(null);
  const sidecarSessionRef = useRef<string | null>(null);

  // Load DB history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/conversations/${sessionId}/messages`);
      if (!r.ok) return;
      const j = (await r.json()) as { messages: DbMessage[] };
      if (!cancelled) {
        setMessages(buildLiveFromDb(j.messages));
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function persistAssistant(blocks: Block[]) {
    const tools = blocks.filter((b): b is ToolBlock => b.kind === "tool");
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
        toolCallJson: tools.length ? { tools } : null,
      }),
    });
  }

  async function persistUser(text: string) {
    await fetch(`/api/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", body: text }),
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", text, authorEmail: currentUserEmail },
      { id: assistantId, role: "assistant", blocks: [] },
    ]);
    setPending(true);

    void persistUser(text);

    const updateAssistant = (fn: (msg: Extract<LiveMsg, { role: "assistant" }>) => void) => {
      setMessages((all) =>
        all.map((msg) => {
          if (msg.id !== assistantId || msg.role !== "assistant") return msg;
          const copy = { ...msg, blocks: [...msg.blocks] };
          fn(copy);
          return copy;
        }),
      );
    };

    try {
      // Mint sidecar token via Vercel
      const tok = await fetch("/api/chat-token", { method: "POST" });
      if (!tok.ok) {
        const errTxt = await tok.text().catch(() => tok.statusText);
        updateAssistant((m) => m.blocks.push({ kind: "text", text: `❌ ${errTxt}` }));
        return;
      }
      const { token, sidecar_url } = (await tok.json()) as {
        token: string;
        sidecar_url: string;
      };
      sidecarUrlRef.current = sidecar_url;

      // First message of this conversation needs claim context. Subsequent
      // messages in the same loaded session reuse the warm subprocess and
      // already have it.
      if (!sidecarSessionRef.current) {
        sidecarSessionRef.current = `claim-${claimId}-${sessionId.slice(0, 8)}`;
      }

      const isFirst = messages.filter((m) => m.role === "assistant").length === 0;
      const userContent = isFirst
        ? `${SIDECAR_CONTEXT_PREAMBLE(claimId, claimTitle)}\n\n${text}`
        : text;

      const res = await fetch(`${sidecar_url}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sidecarSessionRef.current,
          messages: [{ role: "user", content: userContent }],
        }),
      });
      if (!res.ok || !res.body) {
        const errTxt = await res.text().catch(() => res.statusText);
        updateAssistant((m) => m.blocks.push({ kind: "text", text: `❌ ${errTxt}` }));
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
          let eventName = "message";
          let dataStr = "";
          for (const line of ev.split(/\r?\n/)) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr);
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
          } else if (eventName === "tool_use") {
            updateAssistant((m) =>
              m.blocks.push({
                kind: "tool",
                id: (data.id as string) ?? crypto.randomUUID(),
                name: (data.name as string) ?? "?",
                input: (data.input as Record<string, unknown>) ?? {},
              }),
            );
          } else if (eventName === "tool_result") {
            const matchId = (data.tool_use_id as string) ?? "";
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
            // Persist the assembled assistant message
            setMessages((all) => {
              const final = all.find(
                (mm) => mm.id === assistantId && mm.role === "assistant",
              ) as Extract<LiveMsg, { role: "assistant" }> | undefined;
              if (final) void persistAssistant(final.blocks);
              return all;
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateAssistant((m) => m.blocks.push({ kind: "text", text: `❌ ${msg}` }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 text-[12.5px]">
        {!loaded ? (
          <p className="p-3 text-[12px] text-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-subtle/40 p-4 text-[12px] text-muted">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-fg">
              <Sparkles className="h-3 w-3" /> New conversation
            </p>
            <p>
              Claude has full access to the research repo and can read the claim body.
              Try: <em>&ldquo;Summarize the key finding and next steps.&rdquo;</em>
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {m.role === "user"
                    ? m.authorEmail ?? "You"
                    : "Claude"}
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
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {block.text}
                          </ReactMarkdown>
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

      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ask Claude about this claim…"
          rows={2}
          disabled={pending}
          className="flex-1 resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-md bg-fg p-2 text-canvas disabled:opacity-30"
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function ToolCard({ block }: { block: ToolBlock }) {
  const [expanded, setExpanded] = useState(false);
  const summary = formatToolInput(block.name, block.input);
  const status =
    block.ok === undefined ? (
      <Wrench className="h-3 w-3 animate-pulse text-muted" />
    ) : block.ok ? (
      <Check className="h-3 w-3 text-confidence-high" />
    ) : (
      <XIcon className="h-3 w-3 text-red-600" />
    );
  return (
    <div className="rounded-md border border-border bg-subtle/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left"
      >
        <span className="mt-0.5 shrink-0">{status}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {block.name}
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
        <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-words border-t border-border bg-panel p-2 font-mono text-[11px]">
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
  const json = JSON.stringify(input);
  return json.length > 120 ? json.slice(0, 120) + "…" : json;
}

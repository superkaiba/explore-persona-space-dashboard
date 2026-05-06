"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Send, Sparkles } from "lucide-react";

export function ChatRail() {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");

  return (
    <aside
      className="flex h-full flex-col border-l border-border bg-panel transition-[width] duration-200"
      style={{ width: open ? 360 : 44 }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        {open && (
          <div className="flex items-center gap-2 text-[13px] font-medium tracking-tight">
            <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
              <Sparkles className="h-3 w-3" />
            </span>
            <span>Claude agent</span>
            <span className="rounded bg-subtle px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
              M7
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
          <div className="flex-1 overflow-y-auto p-4 text-[12.5px] leading-relaxed text-muted">
            <div className="rounded-lg border border-dashed border-border bg-subtle p-3">
              <p className="font-medium text-fg">Chat backend lands in M7</p>
              <p className="mt-1.5">
                Spawned Claude Code agent over Cloudflare Tunnel → Python sidecar.
                Will read repo, query Supabase, propose follow-ups. Auth-gated.
              </p>
            </div>
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDraft("");
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about a claim, experiment, or the whole project…"
              rows={2}
              disabled
              className="flex-1 resize-none rounded-md border border-border bg-subtle px-2.5 py-1.5 text-[13px] text-fg placeholder:text-muted focus:border-running focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-50"
            />
            <button
              type="submit"
              disabled
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

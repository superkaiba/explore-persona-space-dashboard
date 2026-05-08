"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { ClaudeThread } from "./ClaudeThread";

const STORAGE_KEY = "eps-right-rail-session";

export function ChatRail() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className="flex h-full flex-col border-l border-border bg-panel/60 backdrop-blur transition-[width] duration-300 ease-soft"
      style={{ width: open ? 460 : 48 }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        {open && (
          <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium tracking-tight">
            <span className="accent-ring grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-accent to-accent-strong text-accent-fg">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="serif text-[16px] italic leading-none">Claude</span>
            <span className="rounded-full border border-running/30 bg-running/10 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-wider text-running">
              opus 4.7
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-1.5 text-muted transition-all duration-200 ease-soft hover:bg-subtle hover:text-fg"
          aria-label={open ? "Collapse chat" : "Expand chat"}
        >
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <ClaudeThread
          kind="chat"
          storageKey={STORAGE_KEY}
          placeholder="Ask about a claim, experiment, or the whole project..."
          emptyTitle="Claude Code conversation."
          emptyBody="Pick an existing thread above to resume it, or send a message to start a new dashboard-wide session."
        />
      )}
    </aside>
  );
}

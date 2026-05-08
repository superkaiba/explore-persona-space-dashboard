"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { ClaudeThread } from "./ClaudeThread";

const STORAGE_KEY = "eps-right-rail-session";

export function ChatRail() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className="flex h-full flex-col border-l border-border bg-panel transition-[width] duration-200"
      style={{ width: open ? 440 : 44 }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        {open && (
          <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium tracking-tight">
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

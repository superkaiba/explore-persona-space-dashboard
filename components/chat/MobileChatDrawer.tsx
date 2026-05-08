"use client";

import { useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { ClaudeThread } from "./ClaudeThread";

const STORAGE_KEY = "eps-right-rail-session";

export function MobileChatDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] right-3 z-40 inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-[12px] font-medium text-fg shadow-card md:bottom-4"
        >
          <MessageCircle className="h-3.5 w-3.5 text-muted" />
          Claude
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-panel lg:hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
            <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="text-[13px] font-medium">Claude</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded-md p-1 text-muted hover:bg-subtle hover:text-fg"
              aria-label="Close Claude chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ClaudeThread
            kind="chat"
            storageKey={STORAGE_KEY}
            placeholder="Ask about the dashboard..."
            emptyTitle="Claude Code conversation."
            emptyBody="Send a message to start a dashboard-wide session."
          />
        </div>
      )}
    </div>
  );
}

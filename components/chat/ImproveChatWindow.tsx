"use client";

import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import { Sparkles, Wrench, X } from "lucide-react";
import { ClaudeThread } from "./ClaudeThread";

const STORAGE_KEY = "eps-improve-window-session";
const FRAME_KEY = "eps-improve-window-frame";
const OPEN_KEY = "eps-improve-window-open";
const DEFAULT_WIDTH = 460;
const DEFAULT_HEIGHT = 620;

type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function defaultFrame(): Frame {
  if (typeof window === "undefined") {
    return { x: 80, y: 72, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
  const width = Math.min(DEFAULT_WIDTH, window.innerWidth - 48);
  const height = Math.min(DEFAULT_HEIGHT, window.innerHeight - 72);
  return {
    x: Math.max(24, window.innerWidth - width - 456),
    y: 72,
    width,
    height,
  };
}

function readFrame(): Frame {
  try {
    const raw = window.localStorage.getItem(FRAME_KEY);
    if (!raw) return defaultFrame();
    const parsed = JSON.parse(raw) as Partial<Frame>;
    const fallback = defaultFrame();
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : fallback.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : fallback.y,
      width: Number.isFinite(parsed.width) ? Number(parsed.width) : fallback.width,
      height: Number.isFinite(parsed.height) ? Number(parsed.height) : fallback.height,
    };
  } catch {
    return defaultFrame();
  }
}

export function ImproveChatWindow() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [frame, setFrame] = useState<Frame>(() => defaultFrame());

  useEffect(() => {
    setMounted(true);
    setFrame(readFrame());
    const updateMobile = () => setIsMobile(window.innerWidth < 768);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    try {
      const saved = window.localStorage.getItem(OPEN_KEY);
      setOpen(saved ? saved !== "closed" : window.innerWidth >= 768);
    } catch {}
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  function updateOpen(next: boolean) {
    setOpen(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "open" : "closed");
    } catch {}
  }

  function updateFrame(next: Frame) {
    setFrame(next);
    try {
      window.localStorage.setItem(FRAME_KEY, JSON.stringify(next));
    } catch {}
  }

  if (!mounted) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => updateOpen(true)}
        className="fixed z-40 inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-[12px] font-medium text-fg shadow-card transition-colors hover:bg-subtle"
        style={
          isMobile
            ? { bottom: "calc(env(safe-area-inset-bottom) + 4.25rem)", left: "0.75rem" }
            : { bottom: "1rem", right: "min(456px, calc(100vw - 220px))" }
        }
      >
        <Wrench className="h-3.5 w-3.5 text-muted" />
        Improve
      </button>
    );
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-panel md:hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-subtle/60 px-3 py-2.5">
          <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="min-w-0 truncate text-[13px] font-medium">Dashboard improvements</span>
          <span className="ml-1 rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-running">
            Claude Code
          </span>
          <button
            type="button"
            onClick={() => updateOpen(false)}
            className="ml-auto rounded-md p-1 text-muted transition-colors hover:bg-border hover:text-fg"
            aria-label="Close improvement chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ClaudeThread
          kind="improve"
          storageKey={STORAGE_KEY}
          placeholder="Propose a dashboard change..."
          emptyTitle="No improvement request selected."
          emptyBody="New requests are saved here after you send them."
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 hidden md:block">
      <Rnd
        size={{ width: frame.width, height: frame.height }}
        position={{ x: frame.x, y: frame.y }}
        minWidth={360}
        minHeight={360}
        bounds="window"
        dragHandleClassName="improve-window-drag-handle"
        onDragStop={(_, data) => updateFrame({ ...frame, x: data.x, y: data.y })}
        onResizeStop={(_, __, ref, ___, position) =>
          updateFrame({
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
          })
        }
        className="pointer-events-auto"
      >
        <div className="panel flex h-full flex-col overflow-hidden rounded-lg shadow-rail">
          <div className="improve-window-drag-handle flex shrink-0 cursor-move items-center gap-2 border-b border-border bg-subtle/60 px-3 py-2">
            <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium">Dashboard improvements</span>
            <span className="ml-1 rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-running">
              Claude Code
            </span>
            <button
              type="button"
              onClick={() => updateOpen(false)}
              className="ml-auto rounded p-0.5 text-muted transition-colors hover:bg-border hover:text-fg"
              aria-label="Close improvement chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ClaudeThread
            kind="improve"
            storageKey={STORAGE_KEY}
            placeholder="Propose a dashboard change..."
            emptyTitle="No improvement request selected."
            emptyBody="New requests are saved here after you send them."
          />
        </div>
      </Rnd>
    </div>
  );
}

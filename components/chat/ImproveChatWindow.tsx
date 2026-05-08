"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Wrench, X } from "lucide-react";
import { ClaudeThread } from "./ClaudeThread";

const STORAGE_KEY = "eps-improve-window-session";
const FRAME_KEY = "eps-improve-window-frame";
const OPEN_KEY = "eps-improve-window-open";
const DEFAULT_WIDTH = 460;
const DEFAULT_HEIGHT = 620;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 360;

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

function clampFrame(frame: Frame): Frame {
  if (typeof window === "undefined") return frame;
  const width = Math.min(Math.max(MIN_WIDTH, frame.width), window.innerWidth);
  const height = Math.min(Math.max(MIN_HEIGHT, frame.height), window.innerHeight);
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    width,
    height,
    x: Math.min(Math.max(0, frame.x), maxX),
    y: Math.min(Math.max(0, frame.y), maxY),
  };
}

function readFrame(): Frame {
  try {
    const raw = window.localStorage.getItem(FRAME_KEY);
    if (!raw) return defaultFrame();
    const parsed = JSON.parse(raw) as Partial<Frame>;
    const fallback = defaultFrame();
    return clampFrame({
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : fallback.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : fallback.y,
      width: Number.isFinite(parsed.width) ? Number(parsed.width) : fallback.width,
      height: Number.isFinite(parsed.height) ? Number(parsed.height) : fallback.height,
    });
  } catch {
    return defaultFrame();
  }
}

type DragState = {
  kind: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startFrame: Frame;
};

export function ImproveChatWindow() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [frame, setFrame] = useState<Frame>(() => defaultFrame());
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<Frame>(frame);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

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

  // Re-clamp the frame whenever the viewport size changes so the panel stays
  // reachable after the user resizes the browser.
  useEffect(() => {
    if (!mounted) return;
    const onResize = () => setFrame((f) => clampFrame(f));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted]);

  const persistFrame = useCallback((next: Frame) => {
    try {
      window.localStorage.setItem(FRAME_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  function updateOpen(next: boolean) {
    setOpen(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "open" : "closed");
    } catch {}
  }

  const startMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "move",
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFrame: frameRef.current,
    };
  }, []);

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: "resize",
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFrame: frameRef.current,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (drag.kind === "move") {
      setFrame(
        clampFrame({
          ...drag.startFrame,
          x: drag.startFrame.x + dx,
          y: drag.startFrame.y + dy,
        }),
      );
    } else {
      setFrame(
        clampFrame({
          ...drag.startFrame,
          width: drag.startFrame.width + dx,
          height: drag.startFrame.height + dy,
        }),
      );
    }
  }, []);

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      dragRef.current = null;
      persistFrame(frameRef.current);
    },
    [persistFrame],
  );

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
            Agent
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
    <div
      className="panel fixed z-40 hidden flex-col overflow-hidden rounded-lg shadow-rail md:flex"
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
      }}
    >
      <div
        onPointerDown={startMove}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="flex shrink-0 cursor-move touch-none select-none items-center gap-2 border-b border-border bg-subtle/60 px-3 py-2"
      >
        <span className="grid h-5 w-5 place-items-center rounded bg-fg text-canvas">
          <Sparkles className="h-3 w-3" />
        </span>
        <span className="min-w-0 truncate text-[13px] font-medium">Dashboard improvements</span>
        <span className="ml-1 rounded bg-running/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-running">
          Agent
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
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
      <div
        onPointerDown={startResize}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        aria-hidden="true"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize touch-none select-none"
        style={{
          background:
            "linear-gradient(135deg, transparent 0 50%, rgb(var(--border)) 50% 60%, transparent 60% 70%, rgb(var(--border)) 70% 80%, transparent 80% 90%, rgb(var(--border)) 90% 100%)",
        }}
      />
    </div>
  );
}

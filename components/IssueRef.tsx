"use client";

import { useEffect, useRef, useState } from "react";
import { useWindows, type WindowKind } from "@/components/windows/WindowProvider";

type Resolved = {
  kind: WindowKind;
  id: string;
  title: string;
  confidence?: "HIGH" | "MODERATE" | "LOW" | null;
  status?: string;
  githubIssueNumber: number;
};

const KIND_DOT: Record<WindowKind, string> = {
  project: "bg-fg",
  claim: "bg-confidence-low",
  experiment: "bg-running",
  run: "bg-cyan-600",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
  research_idea: "bg-amber-500",
  lit_item: "bg-emerald-600",
};

const KIND_LABEL: Record<WindowKind, string> = {
  project: "project",
  claim: "claim",
  experiment: "in progress",
  run: "run",
  proposed: "task",
  untriaged: "untriaged",
  research_idea: "idea",
  lit_item: "literature",
};

const cache = new Map<number, Resolved | "missing">();

const HOVER_OPEN_DELAY = 200;
const HOVER_CLOSE_DELAY = 150;

export function IssueRef({ num, children }: { num: number; children?: React.ReactNode }) {
  const { open, windows } = useWindows();
  const [resolved, setResolved] = useState<Resolved | "missing" | null>(
    cache.get(num) ?? null,
  );
  const [showPopover, setShowPopover] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Lazy resolve on first hover.
  async function resolve() {
    if (resolved) return;
    const cached = cache.get(num);
    if (cached) {
      setResolved(cached);
      return;
    }
    try {
      const r = await fetch(`/api/entity/by-issue/${num}`);
      if (!r.ok) {
        cache.set(num, "missing");
        setResolved("missing");
        return;
      }
      const j = (await r.json()) as Resolved;
      cache.set(num, j);
      setResolved(j);
    } catch {
      cache.set(num, "missing");
      setResolved("missing");
    }
  }

  function scheduleOpen() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    openTimer.current = setTimeout(() => {
      void resolve();
      setShowPopover(true);
    }, HOVER_OPEN_DELAY);
  }
  function scheduleClose() {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    closeTimer.current = setTimeout(() => setShowPopover(false), HOVER_CLOSE_DELAY);
  }

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (resolved && resolved !== "missing") {
      open(resolved.kind, resolved.id);
      setShowPopover(false);
    } else {
      // Fall through to GitHub for issues not in the dashboard
      window.open(
        `https://github.com/superkaiba/explore-persona-space/issues/${num}`,
        "_blank",
      );
    }
  }

  const isOpenAlready =
    resolved && resolved !== "missing" && windows.some((w) => w.id === resolved.id);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      className="relative inline"
    >
      <a
        href={`https://github.com/superkaiba/explore-persona-space/issues/${num}`}
        onClick={onClick}
        className="cursor-pointer rounded px-0.5 font-mono text-[0.95em] text-running underline decoration-dotted underline-offset-2 hover:bg-running/10"
      >
        {children ?? `#${num}`}
      </a>
      {showPopover && (
        <span
          onMouseEnter={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
          }}
          onMouseLeave={scheduleClose}
          className="panel pointer-events-auto absolute left-0 top-full z-50 mt-1 w-[280px] rounded-md p-2.5 text-[12px] shadow-rail"
        >
          {resolved === null && <span className="text-muted">Resolving #{num}…</span>}
          {resolved === "missing" && (
            <span className="text-muted">
              <span className="block font-mono text-[10px]">#{num}</span>
              Not in the dashboard. Click to open on GitHub.
            </span>
          )}
          {resolved && resolved !== "missing" && (
            <>
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_DOT[resolved.kind]}`} />
                <span>{KIND_LABEL[resolved.kind]}</span>
                <span className="ml-auto font-mono normal-case tracking-normal">#{num}</span>
              </div>
              <div className="mt-1 line-clamp-3 leading-snug text-fg">{resolved.title}</div>
              <div className="mt-2 text-[10px] text-muted">
                {isOpenAlready
                  ? "Already open in a window — click to focus"
                  : "Click to open in a window"}
              </div>
            </>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Replace `#NN` in markdown source with `[#NN](issue:NN)` so a downstream
 * ReactMarkdown override of the `a` component can render an IssueRef.
 *
 * Negative lookbehind avoids URL fragments / image refs / heading-anchors.
 */
export function linkifyIssueRefs(md: string): string {
  if (!md) return md;
  return md.replace(/(?<![A-Za-z0-9_/\-#])#(\d{1,6})\b/g, "[#$1](issue:$1)");
}

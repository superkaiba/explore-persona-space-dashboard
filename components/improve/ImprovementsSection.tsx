"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Wrench, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AGENT_RUN_STATUS_LABEL,
  type AgentRunStatus,
} from "@/lib/agent-runs";

type Run = {
  id: string;
  mode: string;
  status: AgentRunStatus;
  request: string;
  summary: string | null;
  previewUrl: string | null;
  vercelDeploymentUrl: string | null;
  updatedAt: string;
  completedAt: string | null;
};

const POLL_MS = 6_000;

/** statuses that count as "in flight" — show in the dock at the top */
const ACTIVE: AgentRunStatus[] = [
  "queued",
  "running",
  "awaiting_approval",
  "approved",
  "deploying",
];

/** statuses that draw user attention — pulse the bubble */
const ATTENTION: AgentRunStatus[] = ["awaiting_approval"];

export function ImprovementsSection() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const res = await fetch("/api/agent-runs", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { runs: Run[] };
        if (!alive) return;
        setRuns(data.runs ?? []);
      } catch {
        // ignore — leave previous state
      } finally {
        if (alive) timer = setTimeout(load, POLL_MS);
      }
    }
    load();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const { active, recent } = useMemo(() => {
    if (!runs) return { active: [] as Run[], recent: [] as Run[] };
    const active = runs.filter((r) => ACTIVE.includes(r.status));
    const recent = runs
      .filter((r) => !ACTIVE.includes(r.status))
      .slice(0, 6);
    return { active, recent };
  }, [runs]);

  const attentionCount = active.filter((r) => ATTENTION.includes(r.status)).length;

  const openSuggest = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("eps:improve:open"));
  };

  const openRun = (id: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("eps:improve:open", { detail: { runId: id } }),
    );
  };

  return (
    <section className="mt-5 flex flex-col gap-1">
      <div className="mb-1 flex items-center gap-1.5 px-2.5">
        <Wrench className="h-3 w-3 text-faint" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
          Improvements
        </span>
        {attentionCount > 0 && (
          <span
            className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-fg"
            aria-label={`${attentionCount} runs awaiting approval`}
          >
            {attentionCount}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={openSuggest}
        className="group flex items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-2.5 py-1.5 text-[12px] text-muted transition-all duration-200 ease-soft hover:border-accent/40 hover:bg-subtle/60 hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
        <span>Suggest a change</span>
      </button>

      {active.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {active.map((run) => (
            <RunBubble key={run.id} run={run} onClick={() => openRun(run.id)} />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="px-2.5 text-left text-[10px] font-medium uppercase tracking-[0.14em] text-faint hover:text-muted"
          >
            {showCompleted ? "Hide" : "Show"} recent ({recent.length})
          </button>
          {showCompleted && (
            <div className="flex flex-col gap-1">
              {recent.map((run) => (
                <RunBubble
                  key={run.id}
                  run={run}
                  onClick={() => openRun(run.id)}
                  dim
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RunBubble({
  run,
  onClick,
  dim = false,
}: {
  run: Run;
  onClick: () => void;
  dim?: boolean;
}) {
  const attention = ATTENTION.includes(run.status);
  const running = run.status === "running" || run.status === "queued";
  const deploying = run.status === "deploying" || run.status === "approved";
  const completed = run.status === "completed";
  const failed = run.status === "failed" || run.status === "rejected" || run.status === "cancelled";

  const dotColor = completed
    ? "bg-confidence-high"
    : failed
      ? "bg-rose-500"
      : attention
        ? "bg-accent"
        : "bg-running";

  const truncated = run.request.length > 60
    ? run.request.slice(0, 60).trim() + "…"
    : run.request;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-all duration-200 ease-soft",
        attention
          ? "border-accent/40 bg-accent/10 text-fg shadow-glow"
          : "border-border bg-subtle/40 text-fg hover:border-border-strong hover:bg-subtle",
        dim && "opacity-70 hover:opacity-100",
      )}
      title={`${AGENT_RUN_STATUS_LABEL[run.status]} · ${run.request}`}
    >
      <span className="relative mt-1 flex h-2 w-2 shrink-0 items-center justify-center">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            dotColor,
            (running || deploying) && "shimmer-bubble",
            attention && "animate-pulse-attention",
          )}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate leading-snug">{truncated}</span>
        <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.12em] text-muted">
          <span>{AGENT_RUN_STATUS_LABEL[run.status]}</span>
          {(run.previewUrl || run.vercelDeploymentUrl) && (
            <span className="inline-flex items-center gap-0.5 text-accent">
              <ExternalLink className="h-2.5 w-2.5" />
              {run.vercelDeploymentUrl ? "deploy" : "preview"}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

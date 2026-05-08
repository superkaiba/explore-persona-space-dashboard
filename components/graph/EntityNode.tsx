"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { GRAPH_KIND_LABEL, type GraphEntityKind } from "@/lib/entities";

export type EntityKind = GraphEntityKind;

export type EntityNodeData = {
  kind: EntityKind;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  status: string | null;
  githubIssueNumber: number | null;
  isDimmed?: boolean;
  isRelated?: boolean;
};

export type EntityNodeType = Node<EntityNodeData, "entity">;

const KIND_ACCENT: Record<EntityKind, string> = {
  project: "border-l-fg",
  claim: "border-l-confidence-low",
  experiment: "border-l-running",
  run: "border-l-cyan-600",
  proposed: "border-l-proposed",
  untriaged: "border-l-untriaged",
  research_idea: "border-l-amber-500",
  lit_item: "border-l-emerald-600",
};

const confidenceAccent: Record<NonNullable<EntityNodeData["confidence"]>, string> = {
  HIGH: "border-l-confidence-high",
  MODERATE: "border-l-confidence-moderate",
  LOW: "border-l-confidence-low",
};

const dot: Record<EntityKind, string> = {
  project: "bg-fg",
  claim: "bg-confidence-low",
  experiment: "bg-running",
  run: "bg-cyan-600",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
  research_idea: "bg-amber-500",
  lit_item: "bg-emerald-600",
};

const confDot: Record<NonNullable<EntityNodeData["confidence"]>, string> = {
  HIGH: "bg-confidence-high",
  MODERATE: "bg-confidence-moderate",
  LOW: "bg-confidence-low",
};

function statusBadgeClass(status: string | null): string {
  if (!status) return "bg-subtle text-fg";
  if (status === "planning") return "bg-sky-600 text-white";
  if (status === "plan_pending") return "bg-amber-500 text-black";
  if (status === "blocked") return "bg-red-600 text-white";
  if (status === "awaiting_promotion") return "bg-fuchsia-600 text-white";
  if (["running", "uploading", "implementing", "code_reviewing"].includes(status)) {
    return "bg-blue-600 text-white";
  }
  if (["interpreting", "reviewing"].includes(status)) return "bg-cyan-600 text-white";
  return "bg-slate-600 text-white";
}

export default function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const accentBorder =
    data.kind === "claim" && data.confidence
      ? confidenceAccent[data.confidence]
      : KIND_ACCENT[data.kind];

  const dotClass =
    data.kind === "claim" && data.confidence ? confDot[data.confidence] : dot[data.kind];

  return (
    <div
      className={cn(
        "panel relative w-[248px] cursor-pointer overflow-hidden rounded-md border-l-4 p-3 text-xs shadow-card transition-[border-color,box-shadow,opacity]",
        accentBorder,
        "hover:shadow-cardHover",
        selected ? "ring-2 ring-running ring-offset-2 ring-offset-canvas" : "",
        data.isRelated && !selected ? "ring-1 ring-border" : "",
        data.isDimmed ? "opacity-30 saturate-50" : "",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-border" />

      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted">
        <span className={`inline-block h-2 w-2 rounded-sm ${dotClass}`} />
        <span>{GRAPH_KIND_LABEL[data.kind].toLowerCase()}</span>
        {data.confidence && data.kind === "claim" && (
          <span className="ml-auto rounded bg-subtle px-1.5 py-0.5 font-mono text-[9px] text-fg">
            {data.confidence}
          </span>
        )}
        {data.status && data.kind !== "claim" && (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium ${statusBadgeClass(data.status)}`}
          >
            {data.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="mt-2 line-clamp-3 text-[12.5px] font-medium leading-snug">
        {data.title}
      </div>

      {data.githubIssueNumber != null && (
        <div className="mt-2 font-mono text-[10px] text-muted">
          #{data.githubIssueNumber}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
    </div>
  );
}

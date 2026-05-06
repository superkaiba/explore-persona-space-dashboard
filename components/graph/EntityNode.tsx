"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type EntityKind = "claim" | "experiment" | "proposed" | "untriaged";

export type EntityNodeData = {
  kind: EntityKind;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  status: string | null;
  githubIssueNumber: number | null;
};

export type EntityNodeType = Node<EntityNodeData, "entity">;

const KIND_LABEL: Record<EntityKind, string> = {
  claim: "claim",
  experiment: "running",
  proposed: "proposed",
  untriaged: "untriaged",
};

const KIND_ACCENT: Record<EntityKind, string> = {
  claim: "border-l-confidence-low",
  experiment: "border-l-running",
  proposed: "border-l-proposed",
  untriaged: "border-l-untriaged",
};

const confidenceAccent: Record<NonNullable<EntityNodeData["confidence"]>, string> = {
  HIGH: "border-l-confidence-high",
  MODERATE: "border-l-confidence-moderate",
  LOW: "border-l-confidence-low",
};

const dot: Record<EntityKind, string> = {
  claim: "bg-confidence-low",
  experiment: "bg-running",
  proposed: "bg-proposed",
  untriaged: "bg-untriaged",
};

const confDot: Record<NonNullable<EntityNodeData["confidence"]>, string> = {
  HIGH: "bg-confidence-high",
  MODERATE: "bg-confidence-moderate",
  LOW: "bg-confidence-low",
};

export default function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const accentBorder =
    data.kind === "claim" && data.confidence
      ? confidenceAccent[data.confidence]
      : KIND_ACCENT[data.kind];

  const dotClass =
    data.kind === "claim" && data.confidence ? confDot[data.confidence] : dot[data.kind];

  const isRunning = data.kind === "experiment";

  return (
    <div
      className={[
        "panel relative w-[240px] cursor-pointer overflow-hidden rounded-lg border-l-4 p-3 text-xs shadow-card transition-all",
        accentBorder,
        "hover:shadow-cardHover",
        selected ? "ring-2 ring-running ring-offset-2 ring-offset-canvas" : "",
        isRunning ? "glow-running" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-border" />

      <div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider text-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span>{KIND_LABEL[data.kind]}</span>
        {data.confidence && data.kind === "claim" && (
          <span className="ml-auto rounded bg-subtle px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-fg">
            {data.confidence}
          </span>
        )}
        {data.status && data.kind === "experiment" && (
          <span className="ml-auto rounded bg-subtle px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-fg">
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

      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
    </div>
  );
}

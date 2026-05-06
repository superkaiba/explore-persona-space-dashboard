"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type ClaimNodeData = {
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  githubIssueNumber: number | null;
};

export type ClaimNodeType = Node<ClaimNodeData, "claim">;

const dotForConfidence = (c: ClaimNodeData["confidence"]) => {
  if (c === "HIGH") return "bg-confidence-high";
  if (c === "MODERATE") return "bg-confidence-moderate";
  if (c === "LOW") return "bg-confidence-low";
  return "bg-neutral-400";
};

export default function ClaimNode({ data, selected }: NodeProps<ClaimNodeType>) {
  return (
    <div
      className={[
        "panel relative w-[240px] cursor-pointer rounded-md p-2.5 text-xs shadow-sm transition-shadow hover:shadow-md",
        selected ? "ring-2 ring-blue-500" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-neutral-400" />
      <div className="flex items-start gap-2">
        <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${dotForConfidence(data.confidence)}`} />
        <div className="line-clamp-3 flex-1 leading-snug">{data.title}</div>
      </div>
      {data.githubIssueNumber != null && (
        <div className="mt-1 text-[10px] text-neutral-500">#{data.githubIssueNumber}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-neutral-400" />
    </div>
  );
}

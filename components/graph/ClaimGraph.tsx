"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ClaimNode, { type ClaimNodeType, type ClaimNodeData } from "./ClaimNode";
import { dagreLayout } from "./dagreLayout";

export type ClaimGraphProps = {
  claims: {
    id: string;
    title: string;
    confidence: ClaimNodeData["confidence"];
    githubIssueNumber: number | null;
  }[];
  edges: { fromId: string; toId: string; type: string }[];
};

const nodeTypes = { claim: ClaimNode };

const minimapColor = (n: ClaimNodeType) => {
  const c = n.data.confidence;
  if (c === "HIGH") return "#16a34a";
  if (c === "MODERATE") return "#eab308";
  if (c === "LOW") return "#9ca3af";
  return "#d4d4d4";
};

export default function ClaimGraph({ claims, edges: rawEdges }: ClaimGraphProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "HIGH" | "MODERATE" | "LOW">("ALL");

  const { nodes, edges } = useMemo(() => {
    const visible = filter === "ALL" ? claims : claims.filter((c) => c.confidence === filter);
    const visibleIds = new Set(visible.map((c) => c.id));

    const initialNodes: ClaimNodeType[] = visible.map((c) => ({
      id: c.id,
      type: "claim",
      position: { x: 0, y: 0 },
      data: {
        title: c.title,
        confidence: c.confidence,
        githubIssueNumber: c.githubIssueNumber,
      },
    }));

    const initialEdges: Edge[] = rawEdges
      .filter((e) => visibleIds.has(e.fromId) && visibleIds.has(e.toId))
      .map((e) => ({
        id: `${e.fromId}->${e.toId}-${e.type}`,
        source: e.fromId,
        target: e.toId,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#9ca3af", strokeWidth: 1.5 },
      }));

    return {
      nodes: dagreLayout(initialNodes, initialEdges, "TB"),
      edges: initialEdges,
    };
  }, [claims, rawEdges, filter]);

  const onNodeClick: NodeMouseHandler<ClaimNodeType> = useCallback(
    (_e, node) => {
      router.push(`/claim/${node.id}`);
    },
    [router],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.6}
      >
        <Background gap={16} color="#d4d4d4" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={minimapColor} className="!bg-neutral-100" />
      </ReactFlow>

      <div className="panel absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md p-1 text-xs">
        {(["ALL", "HIGH", "MODERATE", "LOW"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "rounded px-2 py-1 transition-colors",
              filter === f
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
        <span className="ml-2 text-neutral-500">
          {nodes.length} claim{nodes.length === 1 ? "" : "s"} · {edges.length} edge{edges.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

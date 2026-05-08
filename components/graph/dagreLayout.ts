import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_W = 248;
const NODE_H = 110;
const ISOLATED_COLS = 6;
const ISOLATED_X_GAP = 32;
const ISOLATED_Y_GAP = 24;

export function dagreLayout<TNode extends Node>(
  nodes: TNode[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): TNode[] {
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }

  const connectedNodes = nodes.filter((n) => connectedIds.has(n.id));
  const isolatedNodes = nodes.filter((n) => !connectedIds.has(n.id));

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 36,
    ranksep: 104,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of connectedNodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) {
    if (connectedIds.has(e.source) && connectedIds.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  let maxX = 40;
  let minY = 40;
  const positions = new Map<string, { x: number; y: number }>();

  for (const n of connectedNodes) {
    const p = g.node(n.id);
    if (!p) continue;
    const x = p.x - NODE_W / 2;
    const y = p.y - NODE_H / 2;
    positions.set(n.id, { x, y });
    maxX = Math.max(maxX, x + NODE_W);
    minY = Math.min(minY, y);
  }

  const startX = connectedNodes.length > 0 && direction === "LR" ? maxX + 120 : 40;
  const startY = connectedNodes.length > 0 ? minY : 40;
  isolatedNodes.forEach((n, i) => {
    positions.set(n.id, {
      x: startX + (i % ISOLATED_COLS) * (NODE_W + ISOLATED_X_GAP),
      y: startY + Math.floor(i / ISOLATED_COLS) * (NODE_H + ISOLATED_Y_GAP),
    });
  });

  return nodes.map((n) => {
    const p = positions.get(n.id);
    if (!p) return n;
    return {
      ...n,
      position: p,
    } as TNode;
  });
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import EntityNode, { type EntityNodeType, type EntityKind } from "./EntityNode";
import { dagreLayout } from "./dagreLayout";
import EntityHoverPanel, { type HoverEntity } from "./EntityHoverPanel";

export type GraphEntity = {
  id: string;
  kind: EntityKind;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  status: string | null;
  githubIssueNumber: number | null;
  body: string;
};

export type GraphEdge = {
  fromKind: string;
  fromId: string;
  toKind: string;
  toId: string;
  type: string;
};

export type ClaimGraphProps = {
  entities: GraphEntity[];
  edges: GraphEdge[];
};

const nodeTypes = { entity: EntityNode };

const KIND_COLORS: Record<EntityKind, string> = {
  claim: "#9ca3af",
  experiment: "#3b82f6",
  proposed: "#8b5cf6",
  untriaged: "#94a3b8",
};

const minimapColor = (n: EntityNodeType) => {
  if (n.data.kind === "claim" && n.data.confidence) {
    if (n.data.confidence === "HIGH") return "#16a34a";
    if (n.data.confidence === "MODERATE") return "#eab308";
    if (n.data.confidence === "LOW") return "#9ca3af";
  }
  return KIND_COLORS[n.data.kind];
};

const HOVER_OPEN_DELAY = 200;
const HOVER_CLOSE_DELAY = 200;

const ALL_KINDS: EntityKind[] = ["claim", "experiment", "proposed", "untriaged"];
const KIND_LABEL: Record<EntityKind, string> = {
  claim: "Claims",
  experiment: "In progress",
  proposed: "Proposed",
  untriaged: "Untriaged",
};

export default function ClaimGraph({ entities, edges: rawEdges }: ClaimGraphProps) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [enabledKinds, setEnabledKinds] = useState<Set<EntityKind>>(new Set(ALL_KINDS));
  const [confidenceFilter, setConfidenceFilter] = useState<"ALL" | "HIGH" | "MODERATE" | "LOW">("ALL");
  const [search, setSearch] = useState("");
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entityById = useMemo(() => {
    const m = new Map<string, HoverEntity>();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  const { nodes, edges } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = entities.filter((e) => {
      if (!enabledKinds.has(e.kind)) return false;
      if (e.kind === "claim" && confidenceFilter !== "ALL" && e.confidence !== confidenceFilter)
        return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const visibleIds = new Set(visible.map((c) => c.id));

    const initialNodes: EntityNodeType[] = visible.map((c) => ({
      id: c.id,
      type: "entity",
      position: { x: 0, y: 0 },
      data: {
        kind: c.kind,
        title: c.title,
        confidence: c.confidence,
        status: c.status,
        githubIssueNumber: c.githubIssueNumber,
      },
    }));

    const initialEdges: Edge[] = rawEdges
      .filter((e) => visibleIds.has(e.fromId) && visibleIds.has(e.toId))
      .map((e) => ({
        id: `${e.fromId}->${e.toId}-${e.type}`,
        source: e.fromId,
        target: e.toId,
        type: "default", // bezier
        animated: false,
        style: { stroke: "rgb(180 180 188)", strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "rgb(180 180 188)",
          width: 18,
          height: 18,
        },
      }));

    return {
      nodes: dagreLayout(initialNodes, initialEdges, "TB"),
      edges: initialEdges,
    };
  }, [entities, rawEdges, enabledKinds, confidenceFilter, search]);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const cancelOpen = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const scheduleOpen = useCallback(
    (id: string) => {
      if (pinnedId) return; // don't change preview while pinned
      cancelOpen();
      cancelClose();
      openTimerRef.current = setTimeout(() => setHoveredId(id), HOVER_OPEN_DELAY);
    },
    [cancelOpen, cancelClose, pinnedId],
  );
  const scheduleClose = useCallback(() => {
    if (pinnedId) return; // don't auto-close when pinned
    cancelOpen();
    cancelClose();
    closeTimerRef.current = setTimeout(() => setHoveredId(null), HOVER_CLOSE_DELAY);
  }, [cancelOpen, cancelClose, pinnedId]);

  const onNodeMouseEnter: NodeMouseHandler<EntityNodeType> = useCallback(
    (_e, node) => scheduleOpen(node.id),
    [scheduleOpen],
  );
  const onNodeMouseLeave: NodeMouseHandler<EntityNodeType> = useCallback(
    () => scheduleClose(),
    [scheduleClose],
  );

  // Click toggles pin. Shift-click navigates to detail page (claims only).
  const onNodeClick: NodeMouseHandler<EntityNodeType> = useCallback(
    (e, node) => {
      const ent = entityById.get(node.id);
      if (!ent) return;
      if (e.shiftKey || (e as unknown as MouseEvent).metaKey || (e as unknown as MouseEvent).ctrlKey) {
        if (ent.kind === "claim") router.push(`/claim/${node.id}`);
        else if (ent.githubIssueNumber != null) {
          window.open(
            `https://github.com/superkaiba/explore-persona-space/issues/${ent.githubIssueNumber}`,
            "_blank",
          );
        }
        return;
      }
      // Toggle pin
      setPinnedId((prev) => (prev === node.id ? null : node.id));
      setHoveredId(node.id);
    },
    [entityById, router],
  );

  const closePreview = useCallback(() => {
    setPinnedId(null);
    setHoveredId(null);
  }, []);

  const toggleKind = (k: EntityKind) =>
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const counts = useMemo(() => {
    const c: Record<EntityKind, number> = { claim: 0, experiment: 0, proposed: 0, untriaged: 0 };
    for (const e of entities) c[e.kind]++;
    return c;
  }, [entities]);

  const previewedId = pinnedId ?? hoveredId;
  const previewed = previewedId ? entityById.get(previewedId) ?? null : null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={closePreview}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={1.6}
      >
        <Background gap={24} size={1} color="rgb(220 220 226)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={minimapColor} maskColor="rgb(0 0 0 / 0.05)" />
      </ReactFlow>

      {/* Filter rail */}
      <div className="panel absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1 rounded-lg p-1 text-[11px] shadow-card">
        {ALL_KINDS.map((k) => {
          const on = enabledKinds.has(k);
          const dotColor = KIND_COLORS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleKind(k)}
              className={[
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                on ? "bg-subtle text-fg" : "text-muted hover:bg-subtle",
              ].join(" ")}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: dotColor, opacity: on ? 1 : 0.3 }}
              />
              <span className="font-medium">{KIND_LABEL[k]}</span>
              <span className="font-mono text-[10px] text-muted">{counts[k]}</span>
            </button>
          );
        })}
        <div className="mx-1 h-4 w-px bg-border" />
        {(["ALL", "HIGH", "MODERATE", "LOW"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setConfidenceFilter(c)}
            className={[
              "rounded-md px-2 py-1 transition-colors",
              confidenceFilter === c
                ? "bg-fg text-canvas"
                : "text-muted hover:bg-subtle",
            ].join(" ")}
          >
            {c}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-border" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles…"
          className="w-[180px] rounded-md border border-transparent bg-subtle px-2 py-1 text-[11px] text-fg placeholder:text-muted focus:border-running focus:outline-none focus:ring-0"
        />
        <span className="ml-1 font-mono text-[10px] text-muted">
          {nodes.length} · {edges.length} edges
        </span>
      </div>

      {previewed && (
        <EntityHoverPanel
          entity={previewed}
          pinned={pinnedId === previewed.id}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClose={closePreview}
          onTogglePin={() =>
            setPinnedId((prev) => (prev === previewed.id ? null : previewed.id))
          }
        />
      )}
    </div>
  );
}

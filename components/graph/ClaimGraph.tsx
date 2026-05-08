"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ExternalLink, GitBranch, Maximize2, Network, RotateCcw, Search } from "lucide-react";

import EntityNode, { type EntityNodeType, type EntityKind } from "./EntityNode";
import { dagreLayout } from "./dagreLayout";
import { useWindows } from "@/components/windows/WindowProvider";
import {
  GRAPH_ENTITY_KINDS,
  GRAPH_KIND_PLURAL_LABEL,
  displayEdgeType,
  entityHref,
} from "@/lib/entities";
import { cn } from "@/lib/utils";

export type GraphEntity = {
  id: string;
  kind: EntityKind;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  status: string | null;
  githubIssueNumber: number | null;
  body: string;
  slug?: string | null;
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

type ConfidenceFilter = "ALL" | "HIGH" | "MODERATE" | "LOW";
type ViewMode = "work" | "claims" | "all";
type RelationDirection = "incoming" | "outgoing";
type RelationItem = {
  edge: GraphEdge;
  entity: GraphEntity;
  direction: RelationDirection;
};

const nodeTypes = { entity: EntityNode };

const ALL_KINDS: EntityKind[] = [...GRAPH_ENTITY_KINDS];
const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "work", label: "Work" },
  { id: "claims", label: "Claims" },
  { id: "all", label: "All" },
];

const KIND_COLOR: Record<EntityKind, string> = {
  project: "#111827",
  claim: "#9ca3af",
  experiment: "#3b82f6",
  run: "#0891b2",
  proposed: "#8b5cf6",
  untriaged: "#94a3b8",
  research_idea: "#f59e0b",
  lit_item: "#059669",
};

const CONFIDENCE_LABEL: Record<ConfidenceFilter, string> = {
  ALL: "All confidence",
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
};

const EDGE_META: Record<string, { label: string; color: string; marker: string; dashed?: boolean }> = {
  derives_from: {
    label: "derives from",
    color: "rgb(var(--muted))",
    marker: "rgb(var(--muted))",
  },
  supports: {
    label: "supports",
    color: "#16a34a",
    marker: "#16a34a",
  },
  contradicts: {
    label: "contradicts",
    color: "#dc2626",
    marker: "#dc2626",
  },
  parent: {
    label: "parent",
    color: "rgb(var(--muted))",
    marker: "rgb(var(--muted))",
    dashed: true,
  },
  child: {
    label: "child",
    color: "rgb(var(--muted))",
    marker: "rgb(var(--muted))",
    dashed: true,
  },
  sibling: {
    label: "sibling",
    color: "rgb(var(--muted))",
    marker: "rgb(var(--muted))",
    dashed: true,
  },
  cites: {
    label: "cites",
    color: "#059669",
    marker: "#059669",
  },
  inspired_by: {
    label: "inspired by",
    color: "#f59e0b",
    marker: "#f59e0b",
  },
  tests: {
    label: "tests",
    color: "#2563eb",
    marker: "#2563eb",
  },
  produces_evidence_for: {
    label: "evidence for",
    color: "#16a34a",
    marker: "#16a34a",
  },
  blocks: {
    label: "blocks",
    color: "#dc2626",
    marker: "#dc2626",
    dashed: true,
  },
  answers: {
    label: "answers",
    color: "#0891b2",
    marker: "#0891b2",
  },
  duplicates: {
    label: "duplicates",
    color: "rgb(var(--muted))",
    marker: "rgb(var(--muted))",
    dashed: true,
  },
  method: {
    label: "method",
    color: "#2563eb",
    marker: "#2563eb",
  },
  baseline: {
    label: "baseline",
    color: "#7c3aed",
    marker: "#7c3aed",
  },
  background: {
    label: "background",
    color: "#64748b",
    marker: "#64748b",
  },
  threat: {
    label: "threat",
    color: "#dc2626",
    marker: "#dc2626",
  },
  inspiration: {
    label: "inspiration",
    color: "#f59e0b",
    marker: "#f59e0b",
  },
};

const minimapColor = (n: EntityNodeType) => {
  if (n.data.kind === "claim" && n.data.confidence) {
    if (n.data.confidence === "HIGH") return "#16a34a";
    if (n.data.confidence === "MODERATE") return "#eab308";
    if (n.data.confidence === "LOW") return "#9ca3af";
  }
  return KIND_COLOR[n.data.kind];
};

function edgeMeta(type: string) {
  return EDGE_META[type] ?? {
    label: displayEdgeType(type),
    color: "rgb(var(--muted))",
    marker: "rgb(var(--muted))",
  };
}

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

function fullPageHref(entity: GraphEntity) {
  return entityHref(entity.kind, entity.id, entity.slug);
}

function compactBody(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ClaimGraph({ entities, edges: rawEdges }: ClaimGraphProps) {
  const router = useRouter();
  const { open: openWindow } = useWindows();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    entities.some((e) => e.kind !== "claim") ? "work" : "all",
  );
  const [enabledKinds, setEnabledKinds] = useState<Set<EntityKind>>(new Set(ALL_KINDS));
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("ALL");
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [search, setSearch] = useState("");

  const entityById = useMemo(() => {
    const m = new Map<string, GraphEntity>();
    for (const e of entities) m.set(e.id, e);
    return m;
  }, [entities]);

  const modeIds = useMemo(() => {
    const all = new Set(entities.map((e) => e.id));
    const claims = new Set(entities.filter((e) => e.kind === "claim").map((e) => e.id));
    const work = new Set(entities.filter((e) => e.kind !== "claim").map((e) => e.id));

    for (const edge of rawEdges) {
      if (work.has(edge.fromId) || work.has(edge.toId)) {
        work.add(edge.fromId);
        work.add(edge.toId);
      }
    }

    return { all, claims, work };
  }, [entities, rawEdges]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(ALL_KINDS.map((kind) => [kind, 0])) as Record<EntityKind, number>;
    for (const e of entities) c[e.kind]++;
    return c;
  }, [entities]);

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of rawEdges) {
      ids.add(edge.fromId);
      ids.add(edge.toId);
    }
    return ids;
  }, [rawEdges]);

  const viewCounts = useMemo(
    () => ({
      all: modeIds.all.size,
      claims: modeIds.claims.size,
      work: modeIds.work.size,
    }),
    [modeIds],
  );

  const graph = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allowedByMode = modeIds[viewMode];
    const hideUnlinked = !showUnlinked && !q;

    const visible = entities.filter((e) => {
      if (!allowedByMode.has(e.id)) return false;
      if (!enabledKinds.has(e.kind)) return false;
      if (hideUnlinked && !linkedIds.has(e.id)) return false;
      if (e.kind === "claim" && confidenceFilter !== "ALL" && e.confidence !== confidenceFilter) {
        return false;
      }
      if (q) {
        const haystack = [
          e.title,
          e.body,
          e.status,
          e.confidence,
          e.githubIssueNumber != null ? `#${e.githubIssueNumber}` : null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const visibleIds = new Set(visible.map((e) => e.id));
    const selectedVisible = selectedId != null && visibleIds.has(selectedId);
    const relatedIds = new Set<string>();

    if (selectedVisible) {
      for (const edge of rawEdges) {
        if (!visibleIds.has(edge.fromId) || !visibleIds.has(edge.toId)) continue;
        if (edge.fromId === selectedId) relatedIds.add(edge.toId);
        if (edge.toId === selectedId) relatedIds.add(edge.fromId);
      }
    }

    const initialNodes: EntityNodeType[] = visible.map((entity) => ({
      id: entity.id,
      type: "entity",
      selected: selectedId === entity.id,
      position: { x: 0, y: 0 },
      data: {
        kind: entity.kind,
        title: entity.title,
        confidence: entity.confidence,
        status: entity.status,
        githubIssueNumber: entity.githubIssueNumber,
        isDimmed: selectedVisible
          ? entity.id !== selectedId && !relatedIds.has(entity.id)
          : false,
        isRelated: relatedIds.has(entity.id),
      },
    }));

    const initialEdges: Edge[] = rawEdges
      .filter((edge) => visibleIds.has(edge.fromId) && visibleIds.has(edge.toId))
      .map((edge) => {
        const meta = edgeMeta(edge.type);
        const incident = selectedVisible
          ? edge.fromId === selectedId || edge.toId === selectedId
          : false;
        const dimmed = selectedVisible && !incident;

        return {
          id: `${edge.fromId}->${edge.toId}-${edge.type}`,
          source: edge.fromId,
          target: edge.toId,
          type: "default",
          animated: false,
          style: {
            stroke: dimmed ? "rgb(var(--border))" : meta.color,
            strokeWidth: incident ? 2.25 : 1.25,
            opacity: dimmed ? 0.22 : 0.82,
            strokeDasharray: meta.dashed ? "4 4" : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: dimmed ? "rgb(var(--border))" : meta.marker,
            width: incident ? 18 : 14,
            height: incident ? 18 : 14,
          },
        };
      });

    return {
      visible,
      visibleIds,
      relatedIds,
      nodes: dagreLayout(initialNodes, initialEdges, "LR"),
      edges: initialEdges,
    };
  }, [
    entities,
    rawEdges,
    modeIds,
    viewMode,
    enabledKinds,
    confidenceFilter,
    search,
    selectedId,
    linkedIds,
    showUnlinked,
  ]);

  useEffect(() => {
    if (selectedId && !graph.visibleIds.has(selectedId)) setSelectedId(null);
  }, [graph.visibleIds, selectedId]);

  const selectedEntity = selectedId ? entityById.get(selectedId) ?? null : null;

  const relations = useMemo(() => {
    if (!selectedId) return { incoming: [] as RelationItem[], outgoing: [] as RelationItem[] };

    const incoming: RelationItem[] = [];
    const outgoing: RelationItem[] = [];

    for (const edge of rawEdges) {
      if (edge.fromId === selectedId) {
        const entity = entityById.get(edge.toId);
        if (entity) outgoing.push({ edge, entity, direction: "outgoing" });
      } else if (edge.toId === selectedId) {
        const entity = entityById.get(edge.fromId);
        if (entity) incoming.push({ edge, entity, direction: "incoming" });
      }
    }

    return { incoming, outgoing };
  }, [entityById, rawEdges, selectedId]);

  const resetFilters = useCallback(() => {
    setViewMode("all");
    setEnabledKinds(new Set(ALL_KINDS));
    setConfidenceFilter("ALL");
    setShowUnlinked(false);
    setSearch("");
    setSelectedId(null);
  }, []);

  const toggleKind = useCallback((kind: EntityKind) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const openEntityWindow = useCallback(
    (entity: GraphEntity) => {
      openWindow(entity.kind, entity.id);
    },
    [openWindow],
  );

  const openFullPage = useCallback(
    (entity: GraphEntity) => {
      const href = fullPageHref(entity);
      if (href) router.push(href);
    },
    [router],
  );

  const onNodeClick: NodeMouseHandler<EntityNodeType> = useCallback(
    (event, node) => {
      const entity = entityById.get(node.id);
      if (!entity) return;

      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        openFullPage(entity);
        return;
      }

      setSelectedId(node.id);
      openEntityWindow(entity);
    },
    [entityById, openEntityWindow, openFullPage],
  );

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[304px_minmax(0,1fr)] bg-canvas">
      <aside className="flex min-h-0 flex-col border-r border-border bg-panel">
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Network className="h-4 w-4 text-muted" />
            <span>Graph</span>
            <span className="ml-auto font-mono text-[11px] font-normal text-muted">
              {graph.visible.length}/{entities.length}
            </span>
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-md border border-border bg-subtle px-2 focus-within:border-running focus-within:ring-1 focus-within:ring-running">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, status, issue"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[12.5px] outline-none placeholder:text-muted"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowUnlinked((v) => !v);
              setSelectedId(null);
            }}
            className={cn(
              "mt-3 flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-[12px] transition-colors",
              showUnlinked
                ? "border-border bg-subtle text-fg"
                : "border-transparent text-muted hover:bg-subtle hover:text-fg",
            )}
          >
            <span>Show unlinked nodes</span>
            <span className="font-mono text-[10px] text-muted">
              {entities.length - linkedIds.size}
            </span>
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="mb-2 text-[11px] font-medium text-muted">View</div>
          <div className="grid grid-cols-3 gap-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setViewMode(mode.id);
                  setSelectedId(null);
                }}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors",
                  viewMode === mode.id
                    ? "border-fg bg-fg text-canvas"
                    : "border-border bg-panel text-muted hover:bg-subtle hover:text-fg",
                )}
              >
                <span className="block font-medium">{mode.label}</span>
                <span className="font-mono text-[10px] opacity-70">{viewCounts[mode.id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-border p-3">
          <div className="mb-2 text-[11px] font-medium text-muted">Kinds</div>
          <div className="flex flex-col gap-1">
            {ALL_KINDS.map((kind) => {
              const enabled = enabledKinds.has(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors",
                    enabled
                      ? "border-border bg-subtle text-fg"
                      : "border-transparent text-muted hover:bg-subtle",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: KIND_COLOR[kind], opacity: enabled ? 1 : 0.35 }}
                  />
                  <span>{GRAPH_KIND_PLURAL_LABEL[kind]}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">{counts[kind]}</span>
                </button>
              );
            })}
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-medium text-muted">Claim confidence</span>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
              className="w-full rounded-md border border-border bg-panel px-2 py-1.5 text-[12px] text-fg focus:border-running focus:outline-none"
            >
              {(Object.keys(CONFIDENCE_LABEL) as ConfidenceFilter[]).map((key) => (
                <option key={key} value={key}>
                  {CONFIDENCE_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedEntity ? (
            <SelectionPanel
              entity={selectedEntity}
              incoming={relations.incoming}
              outgoing={relations.outgoing}
              onSelect={setSelectedId}
              onOpenWindow={openEntityWindow}
              onOpenFullPage={openFullPage}
            />
          ) : (
            <OverviewPanel
              visible={graph.visible}
              totalEntities={entities.length}
              totalEdges={rawEdges.length}
              visibleEdges={graph.edges.length}
            />
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <GitBranch className="h-3.5 w-3.5" />
            <span>Relationships</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-muted">
            <LegendLine label="derives from" color={EDGE_META.derives_from.color} />
            <LegendLine label="supports" color={EDGE_META.supports.color} />
            <LegendLine label="contradicts" color={EDGE_META.contradicts.color} />
          </div>
        </div>
      </aside>

      <section className="relative min-h-0">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedId(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          defaultViewport={{ x: 32, y: 32, zoom: 0.9 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.12}
          maxZoom={1.4}
        >
          <Background gap={28} size={1} color="rgb(var(--border))" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapColor}
            maskColor="rgb(0 0 0 / 0.05)"
            position="bottom-right"
          />
        </ReactFlow>

        {graph.visible.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="pointer-events-auto rounded-lg border border-border bg-panel p-4 text-center shadow-card">
              <div className="text-[13px] font-medium">No matching linked nodes</div>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted hover:bg-subtle hover:text-fg"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewPanel({
  visible,
  totalEntities,
  totalEdges,
  visibleEdges,
}: {
  visible: GraphEntity[];
  totalEntities: number;
  totalEdges: number;
  visibleEdges: number;
}) {
  const visibleCounts = useMemo(() => {
    const c = Object.fromEntries(ALL_KINDS.map((kind) => [kind, 0])) as Record<EntityKind, number>;
    for (const entity of visible) c[entity.kind]++;
    return c;
  }, [visible]);

  const high = visible.filter((e) => e.kind === "claim" && e.confidence === "HIGH").length;
  const moderate = visible.filter((e) => e.kind === "claim" && e.confidence === "MODERATE").length;
  const low = visible.filter((e) => e.kind === "claim" && e.confidence === "LOW").length;

  return (
    <div className="p-3 text-[12px]">
      <div className="mb-3 font-medium">Overview</div>
      <dl className="divide-y divide-border rounded-md border border-border">
        <OverviewRow label="Visible nodes" value={`${visible.length}/${totalEntities}`} />
        <OverviewRow label="Visible links" value={`${visibleEdges}/${totalEdges}`} />
        <OverviewRow label="Projects" value={visibleCounts.project} />
        <OverviewRow label="Claims" value={visibleCounts.claim} />
        <OverviewRow label="Experiments" value={visibleCounts.experiment} />
        <OverviewRow label="Runs" value={visibleCounts.run} />
        <OverviewRow label="Tasks" value={visibleCounts.proposed} />
        <OverviewRow label="Ideas" value={visibleCounts.research_idea} />
        <OverviewRow label="Literature" value={visibleCounts.lit_item} />
      </dl>

      <div className="mt-4">
        <div className="mb-2 font-medium text-muted">Visible claim confidence</div>
        <div className="divide-y divide-border rounded-md border border-border">
          <OverviewRow label="High" value={high} />
          <OverviewRow label="Moderate" value={moderate} />
          <OverviewRow label="Low" value={low} />
        </div>
      </div>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-[11px] text-fg">{value}</dd>
    </div>
  );
}

function SelectionPanel({
  entity,
  incoming,
  outgoing,
  onSelect,
  onOpenWindow,
  onOpenFullPage,
}: {
  entity: GraphEntity;
  incoming: RelationItem[];
  outgoing: RelationItem[];
  onSelect: (id: string) => void;
  onOpenWindow: (entity: GraphEntity) => void;
  onOpenFullPage: (entity: GraphEntity) => void;
}) {
  const href = fullPageHref(entity);
  const ghHref =
    entity.githubIssueNumber != null
      ? `https://github.com/superkaiba/explore-persona-space/issues/${entity.githubIssueNumber}`
      : null;
  const preview = compactBody(entity.body);

  return (
    <div className="p-3 text-[12px]">
      <div className="mb-2 flex items-center gap-2">
        <EntityKindSwatch entity={entity} />
        <span className="font-medium">{GRAPH_KIND_PLURAL_LABEL[entity.kind].replace(/s$/, "")}</span>
        {entity.confidence && entity.kind === "claim" && (
          <span className="ml-auto rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {entity.confidence}
          </span>
        )}
        {entity.status && entity.kind !== "claim" && (
          <span
            className={cn(
              "ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium",
              statusBadgeClass(entity.status),
            )}
          >
            {entity.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="text-[14px] font-semibold leading-snug">{entity.title}</div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onOpenWindow(entity)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle px-2 py-1 text-[11px] font-medium hover:bg-border"
        >
          <Maximize2 className="h-3 w-3" />
          Open
        </button>
        {href && (
          <button
            type="button"
            onClick={() => onOpenFullPage(entity)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:bg-subtle hover:text-fg"
          >
            Full page
          </button>
        )}
        {ghHref && (
          <a
            href={ghHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:bg-subtle hover:text-fg"
          >
            #{entity.githubIssueNumber}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {preview && (
        <p className="mt-3 line-clamp-5 rounded-md border border-border bg-subtle/50 p-2.5 leading-relaxed text-muted">
          {preview}
        </p>
      )}

      <div className="mt-4 space-y-4">
        <RelationGroup title="Points to" items={outgoing} onSelect={onSelect} />
        <RelationGroup title="Points here" items={incoming} onSelect={onSelect} />
      </div>
    </div>
  );
}

function RelationGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: RelationItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
        <span>{title}</span>
        <span className="font-mono text-[10px]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-2.5 py-2 text-[11px] text-muted">
          No links
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item) => (
            <li key={`${item.edge.fromId}-${item.edge.toId}-${item.edge.type}`}>
              <button
                type="button"
                onClick={() => onSelect(item.entity.id)}
                className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-subtle"
              >
                <EntityKindSwatch entity={item.entity} className="mt-1" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[12px] font-medium leading-snug">
                    {item.entity.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted">
                    {edgeMeta(item.edge.type).label}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EntityKindSwatch({
  entity,
  className,
}: {
  entity: GraphEntity;
  className?: string;
}) {
  const color =
    entity.kind === "claim" && entity.confidence === "HIGH"
      ? "#16a34a"
      : entity.kind === "claim" && entity.confidence === "MODERATE"
        ? "#eab308"
        : KIND_COLOR[entity.kind];
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", className)} style={{ background: color }} />;
}

function LegendLine({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px w-8" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

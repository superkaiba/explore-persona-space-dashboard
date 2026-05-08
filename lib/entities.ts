export const ENTITY_KINDS = [
  "project",
  "claim",
  "experiment",
  "run",
  "todo",
  "research_idea",
  "lit_item",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export const GRAPH_ENTITY_KINDS = [
  "project",
  "claim",
  "experiment",
  "run",
  "proposed",
  "untriaged",
  "research_idea",
  "lit_item",
] as const;

export type GraphEntityKind = (typeof GRAPH_ENTITY_KINDS)[number];

export const EDGE_TYPES = [
  "parent",
  "child",
  "sibling",
  "supports",
  "contradicts",
  "derives_from",
  "cites",
  "inspired_by",
  "tests",
  "produces_evidence_for",
  "blocks",
  "answers",
  "duplicates",
  "method",
  "baseline",
  "background",
  "threat",
  "inspiration",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  project: "Project",
  claim: "Claim",
  experiment: "Experiment",
  run: "Run",
  todo: "Task",
  research_idea: "Research idea",
  lit_item: "Literature",
};

export const GRAPH_KIND_LABEL: Record<GraphEntityKind, string> = {
  project: "Project",
  claim: "Claim",
  experiment: "Experiment",
  run: "Run",
  proposed: "Task",
  untriaged: "Untriaged",
  research_idea: "Research idea",
  lit_item: "Literature",
};

export const GRAPH_KIND_PLURAL_LABEL: Record<GraphEntityKind, string> = {
  project: "Projects",
  claim: "Claims",
  experiment: "Experiments",
  run: "Runs",
  proposed: "Tasks",
  untriaged: "Untriaged",
  research_idea: "Ideas",
  lit_item: "Literature",
};

export function graphKindToEntityKind(kind: GraphEntityKind): EntityKind {
  if (kind === "proposed" || kind === "untriaged") return "todo";
  return kind;
}

export function entityKindToGraphKind(kind: EntityKind, todoKind?: string | null): GraphEntityKind {
  if (kind === "todo") return todoKind === "untriaged" ? "untriaged" : "proposed";
  return kind;
}

export function entityHref(kind: EntityKind | GraphEntityKind, id: string, slug?: string | null): string | null {
  if (kind === "project") return `/projects/${slug ?? id}`;
  if (kind === "claim") return `/claim/${id}`;
  if (kind === "experiment") return `/experiment/${id}`;
  if (kind === "run") return `/run/${id}`;
  if (kind === "todo" || kind === "proposed" || kind === "untriaged") return `/task/${id}`;
  if (kind === "research_idea") return `/lit/ideas/${slug ?? id}`;
  if (kind === "lit_item") return `/lit/items/${id}`;
  return null;
}

export function displayEdgeType(type: string): string {
  return type.replace(/_/g, " ");
}

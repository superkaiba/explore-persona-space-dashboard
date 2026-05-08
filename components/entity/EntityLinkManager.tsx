"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Plus, X } from "lucide-react";
import {
  EDGE_TYPES,
  displayEdgeType,
  type EdgeType,
  type EntityKind,
} from "@/lib/entities";
import {
  EntitySelect,
  entityOptionValue,
  parseEntityOptionValue,
  type EntityOption,
} from "@/components/entity/EntitySelect";

const DEFAULT_EDGE_TYPES: EdgeType[] = [
  "derives_from",
  "supports",
  "contradicts",
  "cites",
  "inspired_by",
  "tests",
  "produces_evidence_for",
  "blocks",
  "answers",
  "background",
  "method",
  "baseline",
];

export function EntityLinkManager({
  fromKind,
  fromId,
  options,
  compact = false,
}: {
  fromKind: EntityKind;
  fromId: string;
  options: EntityOption[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edgeType, setEdgeType] = useState<EdgeType>("derives_from");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filteredOptions = useMemo(
    () =>
      options.filter(
        (option) => !(option.kind === fromKind && option.id === fromId),
      ),
    [fromId, fromKind, options],
  );

  async function addLink() {
    const parsed = parseEntityOptionValue(target);
    if (!parsed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/write/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromKind,
          fromId,
          toKind: parsed.kind,
          toId: parsed.id,
          type: edgeType,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setTarget("");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle px-2.5 py-1.5 text-[12px] font-medium text-fg hover:bg-border"
      >
        <Link2 className="h-3.5 w-3.5" />
        Add link
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void addLink();
      }}
      className="rounded-md border border-border bg-panel p-3 text-[12px]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <Plus className="h-3.5 w-3.5 text-muted" />
          Add entity link
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-muted hover:bg-subtle hover:text-fg"
          aria-label="Close link form"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={compact ? "space-y-2" : "grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]"}>
        <select
          value={edgeType}
          onChange={(e) => setEdgeType(e.target.value as EdgeType)}
          className="w-full rounded-md border border-border bg-panel px-2 py-1.5 text-[12px] focus:border-running focus:outline-none"
        >
          {DEFAULT_EDGE_TYPES.filter((type) => EDGE_TYPES.includes(type)).map((type) => (
            <option key={type} value={type}>
              {displayEdgeType(type)}
            </option>
          ))}
        </select>
        <EntitySelect
          options={filteredOptions}
          value={target}
          onChange={(value) => {
            const parsed = parseEntityOptionValue(value);
            setTarget(parsed ? entityOptionValue(parsed) : "");
          }}
          placeholder="Search entities"
        />
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {error && <div className="mr-auto text-[11px] text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={saving || !target}
          className="rounded-md bg-fg px-2.5 py-1.5 text-[12px] font-medium text-canvas disabled:opacity-40"
        >
          {saving ? "Adding..." : "Add link"}
        </button>
      </div>
    </form>
  );
}

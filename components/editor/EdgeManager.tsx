"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

const EDGE_TYPES = [
  { value: "derives_from", label: "Derives from" },
  { value: "supports", label: "Supports" },
  { value: "contradicts", label: "Contradicts" },
  { value: "sibling", label: "Sibling of" },
  { value: "parent", label: "Parent of" },
  { value: "child", label: "Child of" },
] as const;

type EdgeType = (typeof EDGE_TYPES)[number]["value"];

type ClaimOption = {
  id: string;
  title: string;
  confidence: "HIGH" | "MODERATE" | "LOW" | null;
  githubIssueNumber: number | null;
};

type Props = {
  fromClaimId: string;
  allClaims: ClaimOption[];
  /** Existing target claim ids to dim in the picker (already linked) */
  alreadyLinkedIds?: Set<string>;
};

export function EdgeManager({ fromClaimId, allClaims, alreadyLinkedIds }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EdgeType>("derives_from");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allClaims
      .filter((c) => c.id !== fromClaimId)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || String(c.githubIssueNumber ?? "").includes(q))
      .slice(0, 8);
  }, [allClaims, search, fromClaimId]);

  async function addEdge(toId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/write/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromKind: "claim",
          fromId: fromClaimId,
          toKind: "claim",
          toId,
          type,
        }),
      });
      if (!res.ok) {
        alert(`Failed: ${await res.text()}`);
        return;
      }
      // Soft refresh
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-2 py-1 text-[11px] text-muted transition-colors hover:bg-border hover:text-fg"
      >
        <Plus className="h-3 w-3" />
        Add link
      </button>
    );
  }

  return (
    <div className="panel rounded-md border-border p-2.5 text-[12px]">
      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted">
        <span>Add link</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 hover:bg-subtle hover:text-fg"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as EdgeType)}
        className="mb-2 w-full rounded border border-border bg-panel px-2 py-1 text-[12px]"
      >
        {EDGE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search claims by title or #N…"
        className="mb-2 w-full rounded border border-border bg-panel px-2 py-1 text-[12px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
      />
      <ul className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
        {matches.map((c) => {
          const linked = alreadyLinkedIds?.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={busy || linked}
                onClick={() => addEdge(c.id)}
                className={`flex w-full items-start gap-2 rounded p-1.5 text-left transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50 ${
                  linked ? "" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-2 leading-snug">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                    {c.confidence && <span>{c.confidence}</span>}
                    {c.githubIssueNumber != null && <span>#{c.githubIssueNumber}</span>}
                    {linked && <span className="italic">(already linked)</span>}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {matches.length === 0 && (
          <li className="text-[11px] text-muted">No matches.</li>
        )}
      </ul>
    </div>
  );
}

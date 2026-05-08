"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ENTITY_KIND_LABEL, type EntityKind } from "@/lib/entities";
import { cn } from "@/lib/utils";

export type EntityOption = {
  kind: EntityKind;
  id: string;
  label: string;
  detail?: string | null;
};

export function entityOptionValue(option: Pick<EntityOption, "kind" | "id">): string {
  return `${option.kind}:${option.id}`;
}

export function parseEntityOptionValue(
  value: string,
): { kind: EntityKind; id: string } | null {
  const [kind, id] = value.split(":");
  if (!kind || !id) return null;
  if (!["project", "claim", "experiment", "run", "todo", "research_idea", "lit_item"].includes(kind)) {
    return null;
  }
  return { kind: kind as EntityKind, id };
}

export function EntitySelect({
  options,
  value,
  onChange,
  placeholder = "Search entities",
}: {
  options: EntityOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => entityOptionValue(option) === value) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((option) => {
        if (!q) return true;
        return [
          ENTITY_KIND_LABEL[option.kind],
          option.label,
          option.detail,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 12);
  }, [options, query]);

  return (
    <div className="rounded-md border border-border bg-panel">
      {selected ? (
        <div className="flex items-start gap-2 border-b border-border px-2.5 py-2">
          <span className="mt-0.5 rounded bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            {ENTITY_KIND_LABEL[selected.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[12px] font-medium leading-snug">
              {selected.label}
            </div>
            {selected.detail && (
              <div className="mt-0.5 line-clamp-1 text-[10px] text-muted">{selected.detail}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded p-0.5 text-muted hover:bg-subtle hover:text-fg"
            aria-label="Clear linked entity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <label className="flex items-center gap-2 px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected ? "Change linked entity" : placeholder}
          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted"
        />
      </label>
      <div className="max-h-56 overflow-y-auto border-t border-border">
        {matches.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-muted">No matching entities.</div>
        ) : (
          matches.map((option) => {
            const optionValue = entityOptionValue(option);
            const active = optionValue === value;
            return (
              <button
                key={optionValue}
                type="button"
                onClick={() => {
                  onChange(optionValue);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-subtle",
                  active ? "bg-subtle" : "",
                )}
              >
                <span className="mt-0.5 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {ENTITY_KIND_LABEL[option.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[12px] font-medium leading-snug">
                    {option.label}
                  </span>
                  {option.detail && (
                    <span className="mt-0.5 block line-clamp-1 text-[10px] text-muted">
                      {option.detail}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

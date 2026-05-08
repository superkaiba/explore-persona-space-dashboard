"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { LIT_READ_STATUSES, type LitReadStatus } from "@/lib/lit";

type Props = {
  itemId: string;
  initialReadStatus: LitReadStatus;
  initialNotes: string;
  initialArchived: boolean;
};

export function ItemStateForm({
  itemId,
  initialReadStatus,
  initialNotes,
  initialArchived,
}: Props) {
  const [readStatus, setReadStatus] = useState<LitReadStatus>(initialReadStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [archived, setArchived] = useState(initialArchived);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/lit/item-state", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, readStatus, notes, archived }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Save failed");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    });
  }

  return (
    <section className="rounded-md border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold tracking-tight">My notes</h2>
        {savedAt && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Check className="h-3 w-3" />
            {savedAt}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={readStatus}
            onChange={(event) => setReadStatus(event.target.value as LitReadStatus)}
            className="rounded-md border border-border bg-canvas px-2 py-1.5 text-[12px] text-fg outline-none focus:border-muted"
          >
            {LIT_READ_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "skimmed" ? "Skimmed" : status === "read" ? "Read" : "Unread"}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-md border border-border bg-canvas px-2 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />
            Archive
          </label>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={8}
          className="min-h-40 rounded-md border border-border bg-canvas p-3 text-[13px] leading-relaxed text-fg outline-none focus:border-muted"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-md border border-border bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Saving" : "Save"}
        </button>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
      </div>
    </section>
  );
}

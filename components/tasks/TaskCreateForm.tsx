"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  TASK_INTENT_LABEL,
  TASK_INTENT_MODES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  type TaskIntentMode,
  type TaskPriority,
} from "@/lib/tasks";
import {
  EntitySelect,
  parseEntityOptionValue,
  type EntityOption,
} from "@/components/entity/EntitySelect";

export function TaskCreateForm({
  canCreate,
  linkOptions = [],
}: {
  canCreate: boolean;
  linkOptions?: EntityOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [intentMode, setIntentMode] = useState<TaskIntentMode>("exploratory");
  const [intentSummary, setIntentSummary] = useState("");
  const [usefulIf, setUsefulIf] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [linkValue, setLinkValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) return null;

  async function createTask() {
    const title = text.trim();
    if (!title || saving) return;
    setSaving(true);
    setError(null);
    try {
      const linked = parseEntityOptionValue(linkValue);
      const res = await fetch("/api/write/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: title,
          intentMode,
          intentSummary,
          usefulIf,
          priority,
          linkedKind: linked?.kind ?? null,
          linkedId: linked?.id ?? null,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const json = (await res.json()) as { task: { id: string } };
      router.push(`/task/${json.task.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas transition-opacity hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" />
        New task
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void createTask();
      }}
      className="panel mb-6 rounded-lg p-4 text-[13px]"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold tracking-tight">New research task</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted hover:bg-subtle hover:text-fg"
          aria-label="Close new task form"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Title
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What work should happen?"
          className="mt-1 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Intent
          </span>
          <select
            value={intentMode}
            onChange={(e) => setIntentMode(e.target.value as TaskIntentMode)}
            className="mt-1 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none"
          >
            {TASK_INTENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {TASK_INTENT_LABEL[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Priority
          </span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="mt-1 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Why this is worth doing
        </span>
        <textarea
          value={intentSummary}
          onChange={(e) => setIntentSummary(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      {linkOptions.length > 0 && (
        <label className="mt-3 block">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Linked entity
          </span>
          <div className="mt-1">
            <EntitySelect
              options={linkOptions}
              value={linkValue}
              onChange={setLinkValue}
              placeholder="Search ideas, literature, claims, experiments"
            />
          </div>
        </label>
      )}
      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Useful if
        </span>
        <textarea
          value={usefulIf}
          onChange={(e) => setUsefulIf(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <div className="mt-3 flex items-center justify-end gap-2">
        {error && <p className="mr-auto text-[11px] text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted hover:bg-subtle hover:text-fg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas disabled:opacity-40"
        >
          {saving ? "Creating..." : "Create task"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TASK_INTENT_LABEL,
  TASK_INTENT_MODES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  type TaskIntentMode,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import {
  EntitySelect,
  parseEntityOptionValue,
  type EntityOption,
} from "@/components/entity/EntitySelect";

type TaskEditable = {
  id: string;
  text: string;
  status: TaskStatus;
  intentMode: TaskIntentMode;
  intentSummary: string | null;
  usefulIf: string | null;
  priority: TaskPriority;
  ownerNote: string | null;
  linkedKind: string | null;
  linkedId: string | null;
};

export function TaskEditForm({
  task,
  canEdit,
  linkOptions,
}: {
  task: TaskEditable;
  canEdit: boolean;
  linkOptions: EntityOption[];
}) {
  const router = useRouter();
  const [text, setText] = useState(task.text);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [intentMode, setIntentMode] = useState<TaskIntentMode>(task.intentMode);
  const [intentSummary, setIntentSummary] = useState(task.intentSummary ?? "");
  const [usefulIf, setUsefulIf] = useState(task.usefulIf ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [ownerNote, setOwnerNote] = useState(task.ownerNote ?? "");
  const [linkValue, setLinkValue] = useState(
    task.linkedKind && task.linkedId ? `${task.linkedKind}:${task.linkedId}` : "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLink = useMemo(() => {
    if (!linkValue) return null;
    return parseEntityOptionValue(linkValue);
  }, [linkValue]);

  async function save() {
    if (!canEdit || saving) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/write/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          status,
          intentMode,
          intentSummary,
          usefulIf,
          priority,
          ownerNote,
          linkedKind: selectedLink?.kind ?? null,
          linkedId: selectedLink?.id ?? null,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setMessage("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="panel rounded-lg p-4 text-[13px]">
        <ReadOnly label="Status" value={TASK_STATUS_LABEL[status]} />
        <ReadOnly label="Intent" value={TASK_INTENT_LABEL[intentMode]} />
        <ReadOnly label="Priority" value={TASK_PRIORITY_LABEL[priority]} />
        <ReadOnly label="Why this is worth doing" value={task.intentSummary || "Not recorded"} />
        <ReadOnly label="Useful if" value={task.usefulIf || "Not recorded"} />
        {task.ownerNote && <ReadOnly label="Owner note" value={task.ownerNote} />}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="panel rounded-lg p-4 text-[13px]"
    >
      <h2 className="mb-3 text-[12px] font-semibold tracking-tight">Task controls</h2>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Title
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="mt-1 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none"
          >
            {TASK_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
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
        <label className="block sm:col-span-2">
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
      </div>
      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Why this is worth doing
        </span>
        <textarea
          value={intentSummary}
          onChange={(e) => setIntentSummary(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Useful if
        </span>
        <textarea
          value={usefulIf}
          onChange={(e) => setUsefulIf(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Owner note
        </span>
        <textarea
          value={ownerNote}
          onChange={(e) => setOwnerNote(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <div className="mt-3 flex items-center justify-end gap-2">
        {error && <p className="mr-auto text-[11px] text-red-600">{error}</p>}
        {message && !error && <p className="mr-auto text-[11px] text-muted">{message}</p>}
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="mt-0.5 whitespace-pre-wrap leading-relaxed">{value}</div>
    </div>
  );
}

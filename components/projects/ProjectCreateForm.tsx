"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export function ProjectCreateForm({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreate) return null;

  async function createProject() {
    const name = title.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/write/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, summary }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const json = (await res.json()) as { project: { slug: string } };
      router.push(`/projects/${json.project.slug}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas"
      >
        <Plus className="h-3.5 w-3.5" />
        New project
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void createProject();
      }}
      className="mb-5 rounded-lg border border-border bg-panel p-4 text-[13px]"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold tracking-tight">New project</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted hover:bg-subtle hover:text-fg"
          aria-label="Close new project form"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project name"
          className="mt-1 w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Summary
        </span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        {error && <p className="mr-auto text-[11px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-md bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas disabled:opacity-40"
        >
          {saving ? "Creating..." : "Create project"}
        </button>
      </div>
    </form>
  );
}

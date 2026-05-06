"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Edit3, Save, X } from "lucide-react";

type Props = {
  claimId: string;
  initialBody: string;
  canEdit: boolean;
};

export function EditableBody({ claimId, initialBody, canEdit }: Props) {
  const [body, setBody] = useState(initialBody);
  const [draft, setDraft] = useState(initialBody);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/write/claim/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        alert(`Save failed: ${err}`);
        return;
      }
      setBody(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(body);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="relative">
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="absolute right-0 top-0 z-10 flex items-center gap-1 rounded-md border border-border bg-panel px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted opacity-0 shadow-card transition-opacity hover:text-fg group-hover:opacity-100 [.parent-hover-trigger:hover_&]:opacity-100"
          >
            <Edit3 className="h-3 w-3" />
            Edit body
          </button>
        )}
        <div className="parent-hover-trigger group prose-tight mt-8 text-[13.5px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto"><table>{children}</table></div>
              ),
              // eslint-disable-next-line @next/next/no-img-element
              img: ({ src, alt }) =>
                src ? <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" /> : null,
            }}
          >
            {body || "_(no body)_"}
          </ReactMarkdown>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-border hover:text-fg"
          >
            <Edit3 className="h-3 w-3" />
            Edit body
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Editing markdown · live preview on right
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-border hover:text-fg disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || draft === body}
            className="inline-flex items-center gap-1 rounded-md bg-fg px-2.5 py-1 text-[12px] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          disabled={saving}
          className="h-[70vh] resize-none rounded-md border border-border bg-panel p-3 font-mono text-[12px] leading-relaxed text-fg focus:border-running focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-50"
        />
        <div className="prose-tight h-[70vh] overflow-y-auto rounded-md border border-border bg-panel p-3 text-[12.5px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
              table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
              // eslint-disable-next-line @next/next/no-img-element
              img: ({ src, alt }) =>
                src ? <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" /> : null,
            }}
          >
            {draft || "_(no body)_"}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

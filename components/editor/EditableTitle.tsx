"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  claimId: string;
  initialTitle: string;
  canEdit: boolean;
};

export function EditableTitle({ claimId, initialTitle, canEdit }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function save() {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      setDraft(title);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/write/claim/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        alert(`Save failed: ${err}`);
        setDraft(title);
      } else {
        setTitle(next);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (!canEdit) {
    return (
      <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight">
        {title}
      </h1>
    );
  }

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            setDraft(title);
            setEditing(false);
          }
        }}
        rows={2}
        disabled={saving}
        className="mt-3 w-full resize-none rounded-md border border-running bg-panel px-2 py-1 text-[22px] font-semibold leading-tight tracking-tight text-fg focus:outline-none focus:ring-1 focus:ring-running disabled:opacity-50"
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      className="group mt-3 cursor-text rounded-md px-1 py-0.5 text-[22px] font-semibold leading-tight tracking-tight transition-colors hover:bg-subtle"
      title="Click to edit"
    >
      {title}
      <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted opacity-0 transition-opacity group-hover:opacity-100">
        edit
      </span>
    </h1>
  );
}

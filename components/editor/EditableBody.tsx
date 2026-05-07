"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Edit3 } from "lucide-react";
import { RichBodyEditor } from "./RichBodyEditor";
import { IssueRef, linkifyIssueRefs } from "@/components/IssueRef";

type Props = {
  claimId: string;
  initialBody: string;
  canEdit: boolean;
};

export function EditableBody({ claimId, initialBody, canEdit }: Props) {
  const [body, setBody] = useState(initialBody);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(markdown: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/write/claim/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: markdown }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        alert(`Save failed: ${err}`);
        return;
      }
      setBody(markdown);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <RichBodyEditor
        initialMarkdown={body}
        onSave={save}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    );
  }

  return (
    <div className="relative">
      <div className="prose-tight mt-8 text-[13.5px]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              if (typeof href === "string" && href.startsWith("issue:")) {
                const n = parseInt(href.slice(6), 10);
                if (!Number.isNaN(n)) return <IssueRef num={n}>{children}</IssueRef>;
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            },
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table>{children}</table>
              </div>
            ),
            // eslint-disable-next-line @next/next/no-img-element
            img: ({ src, alt }) =>
              src ? <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" /> : null,
          }}
        >
          {body ? linkifyIssueRefs(body) : "_(no body)_"}
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

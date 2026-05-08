"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  ideaId: string;
};

export function ClarificationForm({ ideaId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/lit/idea/${ideaId}/clarification`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, public: isPublic }),
      });
      if (!res.ok) {
        const responseBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(responseBody?.error ?? "Save failed");
        return;
      }
      setBody("");
      setIsPublic(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-md border border-border bg-panel p-4">
      <h2 className="mb-3 text-[12px] font-semibold tracking-tight">Clarification</h2>
      <div className="flex flex-col gap-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          className="min-h-28 rounded-md border border-border bg-canvas p-3 text-[13px] leading-relaxed text-fg outline-none focus:border-muted"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            Public
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !body.trim()}
            className="rounded-md border border-border bg-fg px-3 py-1.5 text-[12px] font-medium text-canvas disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? "Saving" : "Add"}
          </button>
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
      </div>
    </section>
  );
}

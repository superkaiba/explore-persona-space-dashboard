"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { LitLinkStatus } from "@/lib/lit";

type Props = {
  linkId: string;
  initialStatus: LitLinkStatus;
};

export function LinkReviewControls({ linkId, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<LitLinkStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function patch(nextStatus: LitLinkStatus) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/lit/link/${linkId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Update failed");
        return;
      }
      setStatus(nextStatus);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => patch("accepted")}
        disabled={isPending || status === "accepted"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-canvas text-fg hover:bg-subtle disabled:opacity-45"
        title="Accept link"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => patch("rejected")}
        disabled={isPending || status === "rejected"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-canvas text-fg hover:bg-subtle disabled:opacity-45"
        title="Reject link"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { makeClientId } from "@/lib/client-id";

type Presence = {
  user_id: string;
  email: string | null;
  joined_at: string;
};

type Props = {
  claimId: string;
  /** Email + id of the current viewer (if signed in) */
  selfEmail: string | null;
};

/**
 * Live "X currently viewing" indicator backed by Supabase Realtime presence
 * channel keyed `claim:<id>`. Anonymous viewers join with a per-tab id.
 */
export function PresenceIndicator({ claimId, selfEmail }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<Presence[]>([]);

  useEffect(() => {
    const tabId = (() => {
      try {
        const k = "eps-tab-id";
        let v = window.sessionStorage.getItem(k);
        if (!v) {
          v = makeClientId("tab");
          window.sessionStorage.setItem(k, v);
        }
        return v;
      } catch {
        return makeClientId("tab");
      }
    })();

    const channel = supabase.channel(`claim:${claimId}`, {
      config: { presence: { key: tabId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Presence[]>;
        const flat: Presence[] = Object.values(state).flat();
        setUsers(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: tabId,
            email: selfEmail,
            joined_at: new Date().toISOString(),
          } satisfies Presence);
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [supabase, claimId, selfEmail]);

  if (users.length === 0) return null;

  // De-dupe by email when present (multiple tabs from one user collapse)
  const seen = new Set<string>();
  const distinct = users.filter((u) => {
    const k = u.email ?? u.user_id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-running/15 px-2 py-0.5 text-[10px] font-medium text-running"
      title={distinct.map((u) => u.email ?? "anonymous").join("\n")}
    >
      <Users className="h-2.5 w-2.5" />
      {distinct.length} viewing
    </span>
  );
}

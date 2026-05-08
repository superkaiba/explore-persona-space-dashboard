"use client";

import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import { X } from "lucide-react";
import { useWindows } from "./WindowProvider";
import { EntityWindowContent } from "./EntityWindowContent";
import { createClient } from "@/lib/supabase/client";
import { DEV_USER_EMAIL, isDevAuthBypass } from "@/lib/dev-auth";

const KIND_LABEL: Record<string, string> = {
  project: "project",
  claim: "claim",
  experiment: "experiment",
  run: "run",
  proposed: "task",
  untriaged: "untriaged",
  research_idea: "idea",
  lit_item: "literature",
};

export function WindowsLayer() {
  const { windows, close, focus, move, resize } = useWindows();
  const devEmail = isDevAuthBypass() ? DEV_USER_EMAIL : null;
  const [email, setEmail] = useState<string | null>(devEmail);

  // Track current user email and keep it live across sign-in / sign-out so
  // open windows update immediately after the inline magic-link flow.
  // The magic link opens in a separate tab, so we also re-check on focus.
  useEffect(() => {
    const supabase = createClient();
    const refresh = () =>
      supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? devEmail));
    refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? devEmail);
    });
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [devEmail]);

  if (windows.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {windows.map((w) => (
        <Rnd
          key={w.id}
          size={{ width: w.width, height: w.height }}
          position={{ x: w.x, y: w.y }}
          minWidth={320}
          minHeight={220}
          bounds="window"
          dragHandleClassName="window-drag-handle"
          onDragStop={(_, d) => move(w.id, d.x, d.y)}
          onResizeStop={(_, __, ref, ___, position) => {
            resize(w.id, ref.offsetWidth, ref.offsetHeight);
            move(w.id, position.x, position.y);
          }}
          onMouseDown={() => focus(w.id)}
          style={{ zIndex: w.z }}
          className="pointer-events-auto"
        >
          <div className="panel flex h-full flex-col overflow-hidden rounded-lg shadow-rail">
            <div className="window-drag-handle flex shrink-0 cursor-move items-center gap-2 border-b border-border bg-subtle/60 px-4 py-2">
              <span className="font-mono text-[10px] text-muted">
                {KIND_LABEL[w.kind] ?? w.kind} · drag here
              </span>
              <button
                type="button"
                onClick={() => close(w.id)}
                className="ml-auto rounded p-0.5 text-muted transition-colors hover:bg-border hover:text-fg"
                aria-label="Close"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-panel">
              <EntityWindowContent kind={w.kind} id={w.id} currentUserEmail={email} />
            </div>
          </div>
        </Rnd>
      ))}
    </div>
  );
}

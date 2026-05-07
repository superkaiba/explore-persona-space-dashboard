"use client";

import { Rnd } from "react-rnd";
import { X } from "lucide-react";
import { useWindows } from "./WindowProvider";
import { ClaimWindowContent } from "./ClaimWindowContent";

export function WindowsLayer() {
  const { windows, close, focus, move, resize } = useWindows();

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
            <div className="window-drag-handle flex shrink-0 cursor-move items-center gap-2 border-b border-border bg-subtle/60 px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-muted">claim · drag here</span>
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
              {w.kind === "claim" && <ClaimWindowContent claimId={w.id} />}
            </div>
          </div>
        </Rnd>
      ))}
    </div>
  );
}

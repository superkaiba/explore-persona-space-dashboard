"use client";

import { useEffect, useState } from "react";
import { GitBranch, Activity } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { preset, accent } = useTheme();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Show on terminal / aurora / glitch / mission / vaporwave;
  // hide on editorial / brutalist / sumi-e / noir / newsprint (which honor minimal chrome).
  const show = ["terminal", "aurora", "glitch", "mission", "vaporwave"].includes(
    preset,
  );
  if (!show) return null;

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "--:--:--";

  if (preset === "mission") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden border-t border-accent/40 bg-canvas/95 backdrop-blur md:block">
        <div className="pointer-events-auto flex h-7 items-center gap-3 border-b border-accent/15 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          <span>[ MISSION CTRL ]</span>
          <span className="text-muted">·</span>
          <span className="text-fg">EPS-DSH-{accent.slice(0, 3).toUpperCase()}</span>
          <span className="text-muted">·</span>
          <span>T+ {time}</span>
          <span className="text-muted">·</span>
          <span>SYS: NOMINAL</span>
          <span className="ml-auto">[ <span className="vfd">⌘K</span> SEARCH ]</span>
        </div>
      </div>
    );
  }

  if (preset === "glitch") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden border-t border-fg/30 bg-canvas/95 backdrop-blur md:block">
        <div className="pointer-events-auto flex h-6 items-center gap-3 px-4 font-mono text-[10px] uppercase tracking-[0.18em]">
          <span style={{ color: "rgb(0 255 200)" }}>● link_ok</span>
          <span className="text-muted">/</span>
          <span style={{ color: "rgb(255 0 128)" }} className="glitch-text" data-text={`branch://main`}>
            branch://main
          </span>
          <span className="text-muted">/</span>
          <span className="text-fg">{time}</span>
          <span className="ml-auto text-muted">[esc] disconnect · [⌘k] search</span>
        </div>
      </div>
    );
  }

  if (preset === "vaporwave") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden md:block">
        <div className="pointer-events-auto flex h-7 items-center gap-3 border-t border-fuchsia-400/30 bg-purple-950/80 px-4 font-mono text-[10px] uppercase tracking-[0.3em] text-pink-200/90 backdrop-blur">
          <span className="vapor-chrome serif text-[14px] italic">∞</span>
          <span>サイバー</span>
          <span className="text-fuchsia-300/70">·</span>
          <span>{time}</span>
          <span className="text-fuchsia-300/70">·</span>
          <span>session::active</span>
          <span className="ml-auto">⌘K</span>
        </div>
      </div>
    );
  }

  // terminal / aurora
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden md:block",
        preset === "terminal" && "border-t border-border-strong bg-canvas/95 backdrop-blur",
        preset === "aurora" && "bg-gradient-to-t from-canvas via-canvas/80 to-transparent pt-2",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex items-center gap-3 px-4 font-mono text-[10px] text-muted",
          preset === "terminal" && "h-6",
          preset === "aurora" && "h-7 max-w-7xl",
        )}
      >
        <span className="flex items-center gap-1.5">
          <span className="live-dot" style={{ width: 6, height: 6 }} />
          <span className="uppercase tracking-[0.14em]">live</span>
        </span>
        <span className="text-faint">·</span>
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" />
          <span>main</span>
        </span>
        <span className="text-faint">·</span>
        <span className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          <span>0 active</span>
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="text-faint">accent:</span>
          <span className="text-fg">{accent}</span>
          <span className="text-faint">·</span>
          <span className="kbd">⌘K</span>
          <span className="text-faint">·</span>
          <span className="tabular-nums text-fg">{time}</span>
        </span>
      </div>
    </div>
  );
}

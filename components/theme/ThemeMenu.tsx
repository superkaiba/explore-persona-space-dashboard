"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Monitor, Palette, Check } from "lucide-react";
import { ACCENTS, PRESETS, useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeMenu({ compact = false }: { compact?: boolean }) {
  const { mode, accent, preset, setMode, setAccent, setPreset } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Theme settings"
        className={cn(
          "group flex items-center gap-2 rounded-lg border border-border bg-subtle/60 px-2.5 py-1.5 text-[12px] text-muted transition-all duration-200 ease-soft hover:border-border-strong hover:bg-raised hover:text-fg",
          compact && "px-2",
        )}
      >
        <Palette className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-12" />
        {!compact && (
          <>
            <span className="font-medium text-fg/90">Theme</span>
            <span
              className="ml-auto h-3 w-3 rounded-full border border-border-strong"
              style={{ background: "rgb(var(--accent))" }}
              aria-hidden
            />
          </>
        )}
      </button>

      {open && (
        <div
          className="animate-fade-up absolute bottom-full left-0 z-50 mb-2 w-[280px] origin-bottom-left rounded-xl border border-border bg-panel p-2 shadow-rail backdrop-blur"
          role="menu"
        >
          <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Design preset
          </div>
          <div className="mb-2 flex flex-col gap-1">
            {PRESETS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 ease-soft",
                    active
                      ? "border-accent/40 bg-accent/10 text-fg"
                      : "border-border bg-subtle/40 text-muted hover:border-border-strong hover:bg-subtle hover:text-fg",
                  )}
                >
                  <PresetSwatch id={p.id} active={active} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[12px] font-medium text-fg">{p.label}</span>
                    <span className="truncate text-[10px] text-muted">{p.tagline}</span>
                  </div>
                  {active && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
                </button>
              );
            })}
          </div>

          <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Appearance
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-subtle p-1">
            <ModeButton
              active={mode === "dark"}
              onClick={() => setMode("dark")}
              icon={<Moon className="h-3.5 w-3.5" />}
              label="Dark"
            />
            <ModeButton
              active={mode === "light"}
              onClick={() => setMode("light")}
              icon={<Sun className="h-3.5 w-3.5" />}
              label="Light"
            />
            <ModeButton
              active={mode === "system"}
              onClick={() => setMode("system")}
              icon={<Monitor className="h-3.5 w-3.5" />}
              label="Auto"
            />
          </div>

          <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Accent
          </div>
          <div className="grid grid-cols-6 gap-1.5 px-1.5 pb-1">
            {ACCENTS.map((a) => {
              const active = accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id)}
                  aria-label={a.label}
                  title={a.label}
                  className={cn(
                    "group relative grid h-7 w-7 place-items-center rounded-full border transition-all duration-200 ease-soft",
                    active
                      ? "border-fg/60 scale-110"
                      : "border-border hover:scale-110 hover:border-fg/40",
                  )}
                  style={{ background: `rgb(${a.rgb})` }}
                >
                  {active && (
                    <Check
                      className="h-3.5 w-3.5"
                      style={{
                        color:
                          a.id === "amber" || a.id === "sky" || a.id === "emerald"
                            ? "rgb(20 14 0)"
                            : "white",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-all duration-200 ease-soft",
        active
          ? "bg-panel text-fg shadow-card"
          : "text-muted hover:text-fg",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function PresetSwatch({ id, active }: { id: string; active: boolean }) {
  // Tiny visual previewer per preset — pure CSS, no images.
  const style = swatchStyle(id);
  return (
    <span
      className={cn(
        "grid h-7 w-9 shrink-0 place-items-center overflow-hidden rounded-md border",
        active ? "border-accent/60" : "border-border",
      )}
    >
      <span className="h-full w-full" style={style} />
    </span>
  );
}

function swatchStyle(id: string): React.CSSProperties {
  switch (id) {
    case "editorial":
      return {
        background: "linear-gradient(180deg, rgb(var(--panel)), rgb(var(--subtle)))",
      };
    case "terminal":
      return {
        background: "rgb(var(--canvas))",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgb(var(--border) / 0.55) 0 1px, transparent 1px 4px)",
      };
    case "aurora":
      return {
        background:
          "radial-gradient(ellipse at top left, rgb(var(--accent) / 0.7), rgb(var(--accent-soft) / 0.5), rgb(var(--panel)))",
      };
    case "brutalist":
      return {
        background:
          "linear-gradient(135deg, rgb(var(--accent)) 0 50%, rgb(var(--canvas)) 50% 100%)",
      };
    case "vaporwave":
      return {
        background:
          "linear-gradient(180deg, #ff6cb8 0%, #ffa84a 35%, #ffe07a 50%, #2a0840 70%, #2a0840 100%)",
      };
    case "glitch":
      return {
        background: "#040608",
        backgroundImage:
          "repeating-linear-gradient(90deg, rgb(0 255 200 / 0.7) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgb(255 0 128 / 0.6) 2px 3px, transparent 3px 6px)",
      };
    case "sumie":
      return {
        background:
          "radial-gradient(ellipse at 30% 40%, rgb(60 50 40 / 0.4), transparent 60%), #f0e8da",
      };
    case "mission":
      return {
        background: "#06080a",
        backgroundImage:
          "linear-gradient(rgb(255 138 0 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(255 138 0 / 0.5) 1px, transparent 1px)",
        backgroundSize: "8px 8px, 8px 8px",
      };
    case "noir":
      return {
        background: "#000",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18)",
      };
    case "newsprint":
      return {
        background: "#f4f0e8",
        backgroundImage:
          "radial-gradient(rgb(0 0 0 / 0.45) 0.8px, transparent 1px), linear-gradient(rgb(0 0 0) 1px, transparent 1px)",
        backgroundSize: "3px 3px, 100% 6px",
        backgroundPosition: "0 0, 0 0",
      };
    default:
      return { background: "rgb(var(--canvas))" };
  }
}

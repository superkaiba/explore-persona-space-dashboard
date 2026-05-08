"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export type HeroStat = { label: string; value: number };

export function HeroStats({ stats }: { stats: HeroStat[] }) {
  const { preset } = useTheme();

  if (preset === "editorial") {
    return (
      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-l border-border pl-4">
            <div className="serif text-[44px] italic leading-none text-fg tabular-nums">
              {String(s.value).padStart(2, "0")}
            </div>
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "terminal") {
    return (
      <div className="mt-4 inline-flex flex-wrap gap-px overflow-hidden rounded-md border border-border-strong bg-subtle/40 font-mono text-[11px]">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex items-center gap-2 bg-canvas px-3 py-1.5",
              i > 0 && "border-l border-border-strong",
            )}
          >
            <span className="text-muted">{s.label.replace(/\s/g, "_")}:</span>
            <span className="font-semibold text-accent tabular-nums">
              {String(s.value).padStart(3, "0")}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "brutalist") {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="border-2 border-fg bg-canvas p-3 shadow-[3px_3px_0_0_rgb(var(--fg))]"
          >
            <div className="text-[36px] font-extrabold leading-none text-fg tabular-nums">
              {s.value}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fg">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "vaporwave") {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden border border-fuchsia-400/40 bg-gradient-to-br from-purple-900/60 via-fuchsia-900/40 to-cyan-900/30 p-4 backdrop-blur"
            style={{
              boxShadow:
                "inset 0 1px 0 rgb(255 192 240 / 0.25), 0 0 0 1px rgb(0 255 255 / 0.1), 0 8px 24px rgb(236 72 153 / 0.2)",
            }}
          >
            <div className="vapor-chrome serif text-[44px] italic leading-none tabular-nums">
              {String(s.value).padStart(2, "0")}
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-200/80">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "glitch") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-fg/30 bg-fg/5 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-canvas px-4 py-3 font-mono"
            style={{
              boxShadow:
                "inset 1px 0 0 rgb(0 255 200 / 0.15), inset -1px 0 0 rgb(255 0 128 / 0.15)",
            }}
          >
            <div
              className="glitch-text text-[28px] font-bold leading-none tabular-nums text-fg"
              data-text={String(s.value).padStart(3, "0")}
            >
              {String(s.value).padStart(3, "0")}
            </div>
            <div className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-fg/60">
              ▣ {s.label.replace(/\s/g, "_")}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "sumie") {
    return (
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-3">
            <span className="serif text-[40px] italic leading-none text-fg tabular-nums">
              {s.value}
            </span>
            <span className="text-[12px] text-muted">{s.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "mission") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="border border-accent/40 bg-canvas/80 p-3 font-mono"
          >
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-muted">
              <span>{s.label}</span>
              <span>[{String(s.value).padStart(3, "0")}]</span>
            </div>
            <div className="vfd mt-1 text-[28px] font-bold leading-none tabular-nums">
              {String(s.value).padStart(2, "0")}
            </div>
            <div className="mt-1 h-1 w-full bg-accent/15">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${Math.min(100, (s.value / Math.max(1, Math.max(...stats.map((x) => x.value)))) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "noir") {
    return (
      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <span className="font-mono text-[18px] font-light text-fg tabular-nums">
              {String(s.value).padStart(2, "0")}
            </span>
            <span className="text-[11px] text-muted">{s.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (preset === "newsprint") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-0 border-y border-fg sm:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "px-4 py-3",
              i > 0 && "sm:border-l sm:border-fg/30",
              i > 0 && i % 2 !== 0 && "border-l border-fg/30 sm:border-l",
            )}
          >
            <div className="serif text-[40px] italic leading-none text-fg tabular-nums">
              {s.value}
            </div>
            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-fg">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Aurora (default) — soft pill+number row with glow on hover
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-subtle/70 py-1.5 pl-2 pr-3 text-[11px] transition-all duration-200 ease-soft hover:border-accent/40 hover:shadow-glow"
        >
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong px-1.5 font-mono text-[10px] font-semibold text-accent-fg">
            {s.value}
          </span>
          <span className="text-muted group-hover:text-fg">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

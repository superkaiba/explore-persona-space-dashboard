"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export function EmptyState({ children }: { children: React.ReactNode }) {
  const { preset } = useTheme();

  if (preset === "editorial") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-subtle/30 px-6 py-8 text-center">
        <span aria-hidden className="text-faint text-[18px]">⁂</span>
        <p className="serif text-[16px] italic text-muted">{children}</p>
      </div>
    );
  }

  if (preset === "terminal") {
    return (
      <pre className="rounded-md border border-dashed border-border bg-subtle/40 px-4 py-5 font-mono text-[11px] leading-relaxed text-muted">
        {`// ─── empty ───\n// ${typeof children === "string" ? children : "nothing here"}`}
      </pre>
    );
  }

  if (preset === "brutalist") {
    return (
      <div className="border-2 border-dashed border-fg/60 bg-subtle p-6 text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-fg">
          {children}
        </p>
      </div>
    );
  }

  if (preset === "vaporwave") {
    return (
      <div className="border border-fuchsia-400/30 bg-purple-900/30 px-5 py-7 text-center backdrop-blur">
        <div className="vapor-chrome serif mb-2 text-[28px] italic leading-none">∞</div>
        <p className="serif text-[14px] italic tracking-[0.2em] text-pink-200/80">
          {children}
        </p>
      </div>
    );
  }

  if (preset === "glitch") {
    return (
      <pre className="border border-fg/30 bg-canvas px-4 py-5 font-mono text-[11px] leading-relaxed text-fg/70">
        {`> SCAN COMPLETE\n> RESULTS: 0\n> ${typeof children === "string" ? children : "no signal"}\n> _`}
      </pre>
    );
  }

  if (preset === "sumie") {
    return (
      <div className="flex flex-col items-center gap-3 border border-border/30 bg-panel/60 px-6 py-10 text-center">
        <span className="ink-stroke" style={{ width: 24 }} aria-hidden />
        <p className="serif text-[15px] italic text-muted">{children}</p>
        <span className="ink-stroke" style={{ width: 12 }} aria-hidden />
      </div>
    );
  }

  if (preset === "mission") {
    return (
      <div className="border border-accent/30 bg-canvas/70 px-4 py-5 font-mono text-[11px]">
        <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.2em]">
          <span className="text-accent">[ STATUS: NOMINAL ]</span>
          <span className="text-muted">{"// no items"}</span>
        </div>
        <p className="text-fg/80">{children}</p>
      </div>
    );
  }

  if (preset === "noir") {
    return (
      <p className="border-t border-border py-6 text-center text-[12px] text-muted">
        — {children} —
      </p>
    );
  }

  if (preset === "newsprint") {
    return (
      <div className="border border-fg bg-panel px-4 py-6 text-center">
        <p className="serif text-[14px] italic text-fg">
          {children}
        </p>
        <div className="mt-2 text-[9px] font-bold uppercase tracking-[0.3em] text-muted">
          — end of column —
        </div>
      </div>
    );
  }

  return (
    <p className="rounded-xl border border-dashed border-border bg-subtle/40 p-5 text-center text-[12px] text-muted">
      {children}
    </p>
  );
}

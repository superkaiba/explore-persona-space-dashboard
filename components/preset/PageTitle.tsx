"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Renders a page title with preset-aware character.
 * Pass primary + accent words to highlight the accent portion in italic
 * serif (editorial), accent block (brutalist), etc.
 */
export function PageTitle({
  primary,
  accentWord,
  eyebrow,
}: {
  primary: string;
  accentWord?: string;
  eyebrow?: string;
}) {
  const { preset } = useTheme();

  return (
    <div>
      {eyebrow && preset !== "newsprint" && (
        <div
          className={cn(
            "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
            preset === "brutalist" ? "text-fg" : "text-faint",
          )}
        >
          {preset === "terminal" ? `// ${eyebrow}` : eyebrow}
        </div>
      )}

      {preset === "editorial" && (
        <h1 className="font-semibold tracking-tight text-fg">
          <span className="text-[30px]">{primary} </span>
          {accentWord && (
            <span className="serif text-[44px] font-normal italic text-fg">
              {accentWord}
            </span>
          )}
        </h1>
      )}

      {preset === "terminal" && (
        <h1 className="flex items-baseline gap-2 font-mono text-[22px] font-semibold tracking-tight text-fg">
          <span className="text-accent">›</span>
          <span>{primary}</span>
          {accentWord && <span className="text-accent">{accentWord}</span>}
        </h1>
      )}

      {preset === "brutalist" && (
        <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-tight text-fg">
          {primary}
          {accentWord && (
            <span className="ml-1 inline-block bg-accent px-2 py-0.5 text-accent-fg">
              {accentWord}
            </span>
          )}
        </h1>
      )}

      {preset === "aurora" && (
        <h1 className="font-semibold tracking-tight text-fg">
          <span className="text-[28px]">{primary} </span>
          {accentWord && (
            <span className="serif text-[34px] font-normal italic text-accent-soft">
              {accentWord}
            </span>
          )}
        </h1>
      )}

      {preset === "vaporwave" && (
        <h1 className="font-semibold leading-none tracking-tight">
          <span className="vapor-chrome serif block text-[64px] italic">
            {primary}
          </span>
          {accentWord && (
            <span className="serif mt-1 block text-[28px] italic tracking-[0.3em] text-fg/70">
              {accentWord.toUpperCase()}
            </span>
          )}
        </h1>
      )}

      {preset === "glitch" && (
        <h1 className="flex items-baseline gap-2 font-mono text-[28px] font-bold uppercase leading-none tracking-tight">
          <span className="glitch-text text-fg" data-text={primary}>
            {primary}
          </span>
          {accentWord && (
            <span
              className="glitch-text"
              style={{ color: "rgb(0 255 200)" }}
              data-text={accentWord}
            >
              {`<${accentWord}/>`}
            </span>
          )}
        </h1>
      )}

      {preset === "sumie" && (
        <div className="flex flex-col items-start gap-3">
          <span className="ink-stroke" aria-hidden />
          <h1 className="serif font-normal text-fg">
            <span className="text-[44px] italic leading-[1.05]">{primary}</span>
            {accentWord && (
              <span className="ml-2 text-[44px] italic leading-[1.05] text-muted">
                {accentWord}
              </span>
            )}
          </h1>
        </div>
      )}

      {preset === "mission" && (
        <h1 className="flex items-baseline gap-3 font-mono uppercase leading-none tracking-[0.05em]">
          <span className="vfd text-[36px]">{primary.toUpperCase()}</span>
          {accentWord && (
            <span className="border border-accent/60 px-2 py-1 text-[14px] font-bold text-accent">
              [{accentWord.toUpperCase()}]
            </span>
          )}
        </h1>
      )}

      {preset === "noir" && (
        <h1 className="flex items-baseline gap-2 font-light tracking-tight text-fg">
          <span className="text-[26px]">{primary}</span>
          {accentWord && (
            <span className="text-[26px] font-light text-muted">{accentWord}</span>
          )}
        </h1>
      )}

      {preset === "newsprint" && (
        <div>
          <div className="news-rule mb-3 text-[9px] font-bold uppercase tracking-[0.34em]">
            <span>{`VOL. I · Nº 1 · ${eyebrow ?? "TODAY"}`}</span>
          </div>
          <h1 className="serif font-normal tracking-tight text-fg">
            <span className="block text-[64px] leading-[0.95]">
              {primary}
              {accentWord ? <em className="font-normal italic"> {accentWord}</em> : null}
            </span>
          </h1>
          <div className="news-rule mt-3 text-[9px] font-bold uppercase tracking-[0.34em]">
            <span>· · ·</span>
          </div>
        </div>
      )}
    </div>
  );
}

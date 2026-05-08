import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const rgbVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: rgbVar("--canvas"),
        panel: rgbVar("--panel"),
        subtle: rgbVar("--subtle"),
        raised: rgbVar("--raised"),
        fg: rgbVar("--fg"),
        "fg-soft": rgbVar("--fg-soft"),
        muted: rgbVar("--muted"),
        faint: rgbVar("--faint"),
        border: rgbVar("--border"),
        "border-strong": rgbVar("--border-strong"),
        accent: rgbVar("--accent"),
        "accent-strong": rgbVar("--accent-strong"),
        "accent-soft": rgbVar("--accent-soft"),
        "accent-fg": rgbVar("--accent-fg"),
        confidence: {
          high: "rgb(var(--hi))",
          moderate: "rgb(var(--mod))",
          low: "rgb(var(--lo))",
        },
        running: rgbVar("--running"),
        proposed: rgbVar("--proposed"),
        untriaged: rgbVar("--untriaged"),
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        serif: [
          "var(--font-instrument-serif)",
          "Iowan Old Style",
          "Palatino",
          "Georgia",
          "serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow-rgb) / calc(var(--shadow-strength) * 0.5)), inset 0 1px 0 0 rgb(255 255 255 / 0.02)",
        cardHover:
          "0 6px 18px rgb(var(--shadow-rgb) / calc(var(--shadow-strength) * 0.7)), inset 0 1px 0 0 rgb(255 255 255 / 0.03)",
        rail: "0 16px 40px rgb(var(--shadow-rgb) / calc(var(--shadow-strength) * 0.7))",
        glow: "0 0 0 1px rgb(var(--accent) / 0.4), 0 0 24px -2px rgb(var(--accent) / 0.45)",
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [typography],
};

export default config;

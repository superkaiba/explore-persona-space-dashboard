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
        fg: rgbVar("--fg"),
        muted: rgbVar("--muted"),
        border: rgbVar("--border"),
        subtle: rgbVar("--subtle"),
        confidence: {
          high: "#16a34a",
          moderate: "#eab308",
          low: "#9ca3af",
        },
        running: rgbVar("--running"),
        proposed: rgbVar("--proposed"),
        untriaged: rgbVar("--untriaged"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 0 0 rgb(var(--border) / 0.4)",
        cardHover: "0 4px 12px rgb(0 0 0 / 0.08), 0 1px 0 0 rgb(var(--border) / 0.4)",
        rail: "0 12px 32px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [typography],
};

export default config;

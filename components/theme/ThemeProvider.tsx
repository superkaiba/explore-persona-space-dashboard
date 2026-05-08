"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "dark" | "light" | "system";
export type Accent = "violet" | "indigo" | "sky" | "emerald" | "amber" | "rose";
export type Preset =
  | "editorial"
  | "terminal"
  | "aurora"
  | "brutalist"
  | "vaporwave"
  | "glitch"
  | "sumie"
  | "mission"
  | "noir"
  | "newsprint";

export const ACCENTS: { id: Accent; label: string; rgb: string }[] = [
  { id: "violet", label: "Violet", rgb: "139 92 246" },
  { id: "indigo", label: "Indigo", rgb: "99 102 241" },
  { id: "sky", label: "Sky", rgb: "56 189 248" },
  { id: "emerald", label: "Emerald", rgb: "52 211 153" },
  { id: "amber", label: "Amber", rgb: "245 158 11" },
  { id: "rose", label: "Rose", rgb: "244 114 182" },
];

export const PRESETS: { id: Preset; label: string; tagline: string }[] = [
  { id: "editorial", label: "Editorial", tagline: "Magazine serif, big numerals" },
  { id: "terminal", label: "Terminal", tagline: "Mono, scanlines, status bar" },
  { id: "aurora", label: "Aurora", tagline: "Glow, motion, type-coded rails" },
  { id: "brutalist", label: "Brutalist", tagline: "Hard borders, heavy weights" },
  { id: "vaporwave", label: "Vaporwave", tagline: "Sunset, chrome, retro grid" },
  { id: "glitch", label: "Glitch", tagline: "RGB split, cyberpunk, scanlines" },
  { id: "sumie", label: "Sumi-e", tagline: "Ink wash, zen, calligraphy" },
  { id: "mission", label: "Mission Ctrl", tagline: "Telemetry, orange-on-black" },
  { id: "noir", label: "Noir", tagline: "Pure black, near-invisible chrome" },
  { id: "newsprint", label: "Newsprint", tagline: "Broadsheet serif, halftone, rules" },
];

const THEME_KEY = "eps-theme";
const ACCENT_KEY = "eps-accent";
const PRESET_KEY = "eps-preset";

type Ctx = {
  mode: ThemeMode;
  resolved: "dark" | "light";
  accent: Accent;
  preset: Preset;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: Accent) => void;
  setPreset: (p: Preset) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<Accent>("violet");
  const [preset, setPresetState] = useState<Preset>("aurora");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  // Hydrate from localStorage on first client paint and apply to <html>.
  useEffect(() => {
    const storedMode = (typeof window !== "undefined"
      ? (localStorage.getItem(THEME_KEY) as ThemeMode | null)
      : null) ?? "dark";
    const storedAccent = (typeof window !== "undefined"
      ? (localStorage.getItem(ACCENT_KEY) as Accent | null)
      : null) ?? "violet";
    const storedPreset = (typeof window !== "undefined"
      ? (localStorage.getItem(PRESET_KEY) as Preset | null)
      : null) ?? "aurora";
    setModeState(storedMode);
    setAccentState(storedAccent);
    setPresetState(storedPreset);
  }, []);

  // Apply theme + accent + preset to <html> whenever they change.
  useEffect(() => {
    const r = resolveMode(mode);
    setResolved(r);
    const root = document.documentElement;
    root.dataset.theme = r;
    root.dataset.accent = accent;
    root.dataset.preset = preset;
  }, [mode, accent, preset]);

  // Listen to system theme changes when mode is 'system'.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setResolved(mql.matches ? "light" : "dark");
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  // Reflect resolved mode on <html> when it changes via system.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(THEME_KEY, m);
    } catch {}
  }, []);

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a);
    try {
      localStorage.setItem(ACCENT_KEY, a);
    } catch {}
  }, []);

  const setPreset = useCallback((p: Preset) => {
    setPresetState(p);
    try {
      localStorage.setItem(PRESET_KEY, p);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({ mode, resolved, accent, preset, setMode, setAccent, setPreset }),
    [mode, resolved, accent, preset, setMode, setAccent, setPreset],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe default for non-provider contexts (e.g., during SSR storybook).
    return {
      mode: "dark",
      resolved: "dark",
      accent: "violet",
      preset: "aurora",
      setMode: () => {},
      setAccent: () => {},
      setPreset: () => {},
    };
  }
  return ctx;
}

/**
 * Inline script to set data-theme + data-accent on <html> *before* hydration.
 * Must be rendered in <head> as a string in a <Script> tag with
 * strategy="beforeInteractive" or as a plain <script dangerouslySetInnerHTML>.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var t = localStorage.getItem('${THEME_KEY}') || 'dark';
    var a = localStorage.getItem('${ACCENT_KEY}') || 'violet';
    var p = localStorage.getItem('${PRESET_KEY}') || 'aurora';
    var resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.accent = a;
    document.documentElement.dataset.preset = p;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.accent = 'violet';
    document.documentElement.dataset.preset = 'aurora';
  }
})();
`;

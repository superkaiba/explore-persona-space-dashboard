"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type WindowKind = "claim" | "experiment" | "proposed" | "untriaged";

export type OpenWindow = {
  /** entity id (e.g. claim uuid). Acts as the window's identity — clicking
   *  the same entity again brings the existing window to front, doesn't open
   *  a duplicate. */
  id: string;
  kind: WindowKind;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

type Ctx = {
  windows: OpenWindow[];
  open: (kind: WindowKind, id: string) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number) => void;
};

const C = createContext<Ctx | null>(null);

const STORAGE_KEY = "eps-open-windows";
const DEFAULT_W = 720;
const DEFAULT_H = 560;
const STAGGER = 28;

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);

  // Load on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OpenWindow[];
        if (Array.isArray(parsed)) setWindows(parsed);
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
    } catch {}
  }, [windows]);

  const focus = useCallback((id: string) => {
    setWindows((all) => {
      const top = Math.max(0, ...all.map((w) => w.z));
      return all.map((w) => (w.id === id ? { ...w, z: top + 1 } : w));
    });
  }, []);

  const open = useCallback(
    (kind: WindowKind, id: string) => {
      setWindows((all) => {
        const existing = all.find((w) => w.id === id);
        if (existing) {
          // Bring to front
          const top = Math.max(0, ...all.map((w) => w.z));
          return all.map((w) => (w.id === id ? { ...w, z: top + 1 } : w));
        }
        // New window — stagger position based on count
        const top = Math.max(0, ...all.map((w) => w.z));
        const offset = (all.length % 8) * STAGGER;
        const next: OpenWindow = {
          id,
          kind,
          x: 80 + offset,
          y: 80 + offset,
          width: DEFAULT_W,
          height: DEFAULT_H,
          z: top + 1,
        };
        return [...all, next];
      });
    },
    [],
  );

  const close = useCallback((id: string) => {
    setWindows((all) => all.filter((w) => w.id !== id));
  }, []);

  const move = useCallback((id: string, x: number, y: number) => {
    setWindows((all) =>
      all.map((w) => (w.id === id ? { ...w, x: Math.max(0, x), y: Math.max(0, y) } : w)),
    );
  }, []);

  const resize = useCallback((id: string, width: number, height: number) => {
    setWindows((all) =>
      all.map((w) =>
        w.id === id ? { ...w, width: Math.max(280, width), height: Math.max(200, height) } : w,
      ),
    );
  }, []);

  return (
    <C.Provider value={{ windows, open, close, focus, move, resize }}>{children}</C.Provider>
  );
}

export function useWindows(): Ctx {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useWindows must be used inside <WindowProvider>");
  return ctx;
}

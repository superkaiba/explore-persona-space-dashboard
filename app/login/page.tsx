"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("superkaiba");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setStatus("sending");
    setErrorMsg(null);

    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMsg(body?.error ?? "Sign in failed");
      setStatus("error");
      return;
    }

    const next =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || "/inbox"
        : "/inbox";
    window.location.assign(next);
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="panel w-full max-w-[360px] rounded-lg p-6">
        <h1 className="mb-1 text-lg font-semibold">EPS Dashboard</h1>
        <p className="mb-6 text-sm text-muted">
          Sign in to edit and run dashboard improvements.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Username</span>
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border border-border bg-panel px-2 py-1.5 text-fg focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border bg-panel px-2 py-1.5 text-fg focus:border-running focus:outline-none focus:ring-1 focus:ring-running"
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending" || !username.trim() || !password}
            className="rounded-md bg-fg px-3 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {status === "sending" ? "Signing in..." : "Sign in"}
          </button>
          {status === "error" && errorMsg && (
            <div className="text-xs text-red-600">{errorMsg}</div>
          )}
        </form>
      </div>
    </div>
  );
}

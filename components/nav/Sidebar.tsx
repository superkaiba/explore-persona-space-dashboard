"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, Activity, ListTodo, CalendarDays, Sparkles, Plus, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/live", label: "Queue", icon: Activity },
  { href: "/todos", label: "Tasks", icon: ListTodo },
  { href: "/lit", label: "Literature", icon: BookOpen },
  { href: "/timeline/today", label: "Today", icon: CalendarDays },
  { href: "/timeline/week", label: "Week", icon: CalendarDays },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full flex-col border-r border-border bg-panel p-3">
      <Link href="/graph" className="mb-6 flex items-center gap-2 px-2 py-1">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-fg text-canvas">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight">EPS</span>
      </Link>
      <nav className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-subtle text-fg font-medium"
                  : "text-muted hover:bg-subtle hover:text-fg",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="mt-auto flex items-center justify-center gap-1.5 rounded-md border border-border bg-subtle px-2.5 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-border"
      >
        <Plus className="h-3.5 w-3.5" />
        New claim
      </button>
    </aside>
  );
}

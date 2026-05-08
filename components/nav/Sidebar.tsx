"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  Activity,
  ListTodo,
  CalendarDays,
  Sparkles,
  Plus,
  BookOpen,
  Inbox,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { ImprovementsSection } from "@/components/improve/ImprovementsSection";

const groups: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    label: "Workspace",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/graph", label: "Graph", icon: Network },
    ],
  },
  {
    label: "Activity",
    items: [
      { href: "/live", label: "Queue", icon: Activity },
      { href: "/todos", label: "Tasks", icon: ListTodo },
      { href: "/lit", label: "Literature", icon: BookOpen },
    ],
  },
  {
    label: "Updates",
    items: [
      { href: "/timeline/today", label: "Daily", icon: CalendarDays },
      { href: "/timeline/week", label: "Weekly", icon: CalendarDays },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full flex-col border-r border-border bg-panel/60 px-3 py-4 backdrop-blur">
      <div className="mb-6 flex items-center gap-2 px-2 py-1">
        <Link
          href="/graph"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <span className="accent-ring grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent to-accent-strong text-accent-fg">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-semibold tracking-tight">EPS</span>
            <span className="serif text-[15px] italic leading-none text-muted">
              dashboard
            </span>
          </span>
        </Link>
        <button
          type="button"
          aria-label="New claim"
          title="New claim"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md border border-border text-muted transition-all duration-200 ease-soft hover:border-accent/40 hover:bg-subtle hover:text-fg"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <nav className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              {group.label}
            </div>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-200 ease-soft",
                    active
                      ? "bg-subtle text-fg font-medium"
                      : "text-muted hover:bg-subtle/70 hover:text-fg",
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-accent"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      active ? "text-accent" : "text-muted group-hover:text-fg",
                    )}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <ImprovementsSection />

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <ThemeMenu />
      </div>
    </aside>
  );
}

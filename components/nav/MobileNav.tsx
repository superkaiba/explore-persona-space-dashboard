"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Inbox,
  ListTodo,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/timeline/today", label: "Updates", icon: CalendarDays },
  { href: "/todos", label: "Tasks", icon: ListTodo },
  { href: "/lit", label: "Lit", icon: BookOpen },
  { href: "/graph", label: "Graph", icon: Network },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-panel/85 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-2 backdrop-blur-md md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-all duration-200 ease-soft",
                active
                  ? "text-fg"
                  : "text-muted hover:text-fg",
              )}
            >
              {active && (
                <span
                  className="absolute -top-2 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-accent"
                  aria-hidden
                />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active ? "text-accent" : "text-muted group-hover:text-fg",
                )}
              />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

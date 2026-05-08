"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FolderKanban,
  Inbox,
  ListTodo,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/todos", label: "Tasks", icon: ListTodo },
  { href: "/lit", label: "Lit", icon: BookOpen },
  { href: "/graph", label: "Graph", icon: Network },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-panel/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1.5 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[10px] transition-colors",
                active ? "bg-subtle text-fg" : "text-muted hover:bg-subtle hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

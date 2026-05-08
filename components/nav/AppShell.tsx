"use client";

import { usePathname } from "next/navigation";
import { ChatRail } from "@/components/chat/ChatRail";
import { ImproveChatWindow } from "@/components/chat/ImproveChatWindow";
import { MobileChatDrawer } from "@/components/chat/MobileChatDrawer";
import { MobileNav } from "@/components/nav/MobileNav";
import { Sidebar } from "@/components/nav/Sidebar";
import { StatusBar } from "@/components/preset/StatusBar";
import { WindowProvider } from "@/components/windows/WindowProvider";
import { WindowsLayer } from "@/components/windows/WindowsLayer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mentorView = pathname.startsWith("/mentor");

  if (mentorView) {
    return (
      <main className="relative z-10 h-dvh min-h-0 overflow-y-auto bg-canvas">
        {children}
      </main>
    );
  }

  return (
    <WindowProvider>
      <div className="relative z-10 flex h-dvh min-h-0 flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_460px]">
        <div className="hidden min-h-0 md:block">
          <Sidebar />
        </div>
        <main className="min-h-0 overflow-hidden pb-14 md:pb-7">{children}</main>
        <div className="hidden min-h-0 lg:block">
          <ChatRail />
        </div>
      </div>
      <StatusBar />
      <MobileNav />
      <MobileChatDrawer />
      <WindowsLayer />
      <ImproveChatWindow />
    </WindowProvider>
  );
}

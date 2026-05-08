import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNav } from "@/components/nav/MobileNav";
import { ChatRail } from "@/components/chat/ChatRail";
import { MobileChatDrawer } from "@/components/chat/MobileChatDrawer";
import { ImproveChatWindow } from "@/components/chat/ImproveChatWindow";
import { WindowProvider } from "@/components/windows/WindowProvider";
import { WindowsLayer } from "@/components/windows/WindowsLayer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EPS Dashboard",
  description: "Research dashboard for explore-persona-space",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen overflow-hidden bg-canvas font-sans text-fg antialiased">
        <WindowProvider>
          <div className="flex h-dvh min-h-0 flex-col md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_440px]">
            <div className="hidden min-h-0 md:block">
              <Sidebar />
            </div>
            <main className="min-h-0 overflow-hidden pb-14 md:pb-0">{children}</main>
            <div className="hidden min-h-0 lg:block">
              <ChatRail />
            </div>
          </div>
          <MobileNav />
          <MobileChatDrawer />
          <WindowsLayer />
          <ImproveChatWindow />
        </WindowProvider>
      </body>
    </html>
  );
}

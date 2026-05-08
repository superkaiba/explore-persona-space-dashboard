import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNav } from "@/components/nav/MobileNav";
import { ChatRail } from "@/components/chat/ChatRail";
import { MobileChatDrawer } from "@/components/chat/MobileChatDrawer";
import { ImproveChatWindow } from "@/components/chat/ImproveChatWindow";
import { WindowProvider } from "@/components/windows/WindowProvider";
import { WindowsLayer } from "@/components/windows/WindowsLayer";
import { ThemeProvider, themeBootstrapScript } from "@/components/theme/ThemeProvider";
import { StatusBar } from "@/components/preset/StatusBar";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
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
    <html
      lang="en"
      data-theme="dark"
      data-accent="violet"
      data-preset="aurora"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply theme + accent before paint to avoid flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="relative min-h-screen overflow-hidden bg-canvas font-sans text-fg antialiased">
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}

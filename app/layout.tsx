import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/nav/Sidebar";
import { ChatRail } from "@/components/chat/ChatRail";

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
      <body className="min-h-screen bg-canvas font-sans text-fg antialiased">
        <div className="grid h-screen grid-cols-[220px_1fr_360px]">
          <Sidebar />
          <main className="overflow-hidden">{children}</main>
          <ChatRail />
        </div>
      </body>
    </html>
  );
}

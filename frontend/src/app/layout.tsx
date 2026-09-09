import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import {
  BarChart3,
  FolderKanban,
  FileSpreadsheet,
  Terminal,
  Trophy,
} from "lucide-react";

export const metadata: Metadata = {
  title: "CF Tracker - Codeforces Training & Performance Platform",
  description:
    "Decoupled tracking and analytics platform for Codeforces training cohorts, ICPC training groups, and contest performance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col font-sans">
        {/* Modern Navigation Header */}
        <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                  CF Tracker
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                    NMU
                  </span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono tracking-wide">
                  ICPC Training Platform
                </span>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/groups"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <FolderKanban className="w-4 h-4 text-amber-400" />
                <span>Training Groups</span>
              </Link>

              <Link
                href="/spreadsheets"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Spreadsheets</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main page content */}
        <main className="flex-1 max-w-7xl mx-auto w-full">{children}</main>

        {/* Footer */}
        <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
          <p>
            CF Tracker • NMU ICPC Community • Built with FastAPI, PostgreSQL & Next.js
          </p>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TraderJew",
  description: "Track fake & real trading portfolios driven by the claw bot.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-white shadow-lg shadow-accent/20">
                ◈
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Trader<span className="text-muted">Jew</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
              >
                Portfolios
              </Link>
              <Link
                href="/recommendations"
                className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
              >
                Signals
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
        <footer className="border-t border-border-soft py-6 text-center text-xs text-faint">
          Dummy trading · driven by the claw bot
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Coffee Trader CRM",
  description: "A human-focused CRM for a specialty coffee trader.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-20 sm:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:flex sm:gap-8 sm:px-8">
          <aside className="hidden sm:block sm:w-40">
            <DesktopNav />
          </aside>
          <main className="flex-1">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}

function DesktopNav() {
  return (
    <nav className="sticky top-6 flex flex-col gap-3 text-espresso/80">
      <a href="/" className="font-semibold text-espresso">
        ☕ Coffee CRM
      </a>
      <a href="/" className="hover:text-terracotta">Home</a>
      <a href="/contacts" className="hover:text-terracotta">People</a>
      <a href="/capture" className="hover:text-terracotta">Capture card</a>
    </nav>
  );
}

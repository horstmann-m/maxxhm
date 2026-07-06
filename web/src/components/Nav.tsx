"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Map", icon: "🗺️", exact: true },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/notes", label: "Notes", icon: "📝" },
  { href: "/tastings", label: "Tastings", icon: "☕" },
  { href: "/watchlist", label: "Watchlist", icon: "⭐" },
  { href: "/search", label: "Search", icon: "🔎" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="md:w-56 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-surface md:sticky md:top-0 md:h-screen shrink-0">
      <div className="p-4 flex md:block items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🌍</span>
          <span className="font-bold text-lg tracking-tight">Roastmap</span>
        </Link>
        <p className="hidden md:block text-xs text-muted mt-1">
          Green coffee sourcing intelligence
        </p>
      </div>
      <ul className="flex md:flex-col gap-1 px-2 pb-3 overflow-x-auto">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                isActive(l.href, l.exact)
                  ? "bg-accent text-accent-fg font-medium"
                  : "text-foreground hover:bg-surface-2"
              }`}
            >
              <span aria-hidden>{l.icon}</span>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

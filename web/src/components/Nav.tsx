"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, NavIcon } from "@/components/icons";

const LINKS = [
  { href: "/", label: "Map", icon: "map", exact: true },
  { href: "/recommend", label: "Buy now", icon: "recommend" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/weather", label: "Weather", icon: "weather" },
  { href: "/notes", label: "Notes", icon: "notes" },
  { href: "/tastings", label: "Tastings", icon: "tastings" },
  { href: "/watchlist", label: "Watchlist", icon: "watchlist" },
  { href: "/search", label: "Search", icon: "search" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-surface md:sticky md:top-0 md:h-screen shrink-0">
      <div className="px-5 pt-5 pb-3 flex md:block items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-accent">
            <Logo size={30} />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Parchment</span>
        </Link>
        <p className="hidden md:block text-xs text-muted mt-1.5 pl-[42px] -mt-1">
          Green coffee sourcing intelligence
        </p>
      </div>
      <ul className="flex md:flex-col gap-0.5 px-3 pb-3 md:pt-2 overflow-x-auto">
        {LINKS.map((l) => {
          const active = isActive(l.href, "exact" in l ? l.exact : undefined);
          return (
            <li key={l.href} className="relative">
              {active && (
                <span className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent" />
              )}
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <NavIcon name={l.icon} />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

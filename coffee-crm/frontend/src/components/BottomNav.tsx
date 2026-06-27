"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "☕" },
  { href: "/contacts", label: "People", icon: "👤" },
  { href: "/deals", label: "Deals", icon: "🤝" },
  { href: "/prices", label: "Prices", icon: "📈" },
  { href: "/capture", label: "Capture", icon: "📷" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-clay bg-parchment/95 backdrop-blur sm:hidden">
      <ul className="flex justify-around py-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-1 text-xs ${
                  active ? "text-terracotta font-medium" : "text-espresso/60"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, BarChart2, Sparkles, ShoppingBag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/garage", icon: Car, label: "Garage" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/visualizer", icon: Sparkles, label: "Visualize" },
  { href: "/shop", icon: ShoppingBag, label: "Shop" },
  { href: "/community", icon: Users, label: "Community" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-[var(--color-border)] pb-safe-area-inset-bottom"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] rounded-xl transition-all duration-150",
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.75}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

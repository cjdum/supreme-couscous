"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, GalleryHorizontal, Globe, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/garage",    icon: Car,               label: "Garage" },
  { href: "/cards",     icon: GalleryHorizontal, label: "Cards" },
  { href: "/feed",      icon: Globe,             label: "Feed" },
  { href: "/community", icon: Users,             label: "Community" },
  { href: "/mint",      icon: Sparkles,          label: "Mint" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-[var(--color-border)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch h-[64px] max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1.5 min-h-[44px] rounded-2xl transition-all duration-200 relative",
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-[var(--color-accent)]" />
              )}
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} aria-hidden="true" />
              <span
                className={cn(
                  "text-[10px] font-bold leading-none",
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

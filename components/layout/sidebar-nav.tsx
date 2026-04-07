"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Car, Sparkles, MessageSquare, Zap, BarChart2, User, LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  username?: string | null;
}

const NAV_ITEMS = [
  { href: "/garage", icon: Car, label: "Garage", shortcut: "G" },
  { href: "/visualizer", icon: Zap, label: "Visualizer", shortcut: "V" },
  { href: "/chat", icon: MessageSquare, label: "AI Chat", shortcut: "C" },
  { href: "/forum", icon: Sparkles, label: "Forum", shortcut: "" },
  { href: "/stats", icon: BarChart2, label: "Stats", shortcut: "S" },
];

export function SidebarNav({ username }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 z-40 flex-col border-r border-[var(--color-border)] glass">
      {/* Logo */}
      <div className="px-6 pt-6 pb-8">
        <Link href="/garage" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm group-hover:scale-105 transition-transform duration-200">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="4.5" cy="10" r="1" fill="white" />
              <circle cx="9.5" cy="10" r="1" fill="white" />
            </svg>
          </div>
          <span className="font-black text-sm tracking-[0.2em] text-gradient-blue uppercase">MODVAULT</span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3" aria-label="Main navigation">
        <div className="space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label, shortcut }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group",
                  active
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)]"
                    : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-elevated)]"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full" />
                )}
                <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
                <span className="text-sm font-bold flex-1">{label}</span>
                {shortcut && (
                  <kbd className={cn(
                    "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors",
                    active
                      ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-bright)]"
                      : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                  )}>
                    {shortcut}
                  </kbd>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-white uppercase">{username?.[0] ?? "U"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">@{username ?? "user"}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
              <User size={9} /> Profile
            </p>
          </div>
        </Link>
        <Link
          href="/settings"
          className={cn(
            "w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-xs font-bold cursor-pointer",
            pathname.startsWith("/settings")
              ? "bg-[var(--color-bg-elevated)] text-white"
              : "text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-elevated)]"
          )}
        >
          <Settings size={14} />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors text-xs font-bold cursor-pointer"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

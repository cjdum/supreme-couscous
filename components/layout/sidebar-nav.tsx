"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Car, Sparkles, MessageSquare, Zap, BarChart2, User, LogOut, Settings, GalleryHorizontal, Globe, Trophy, HelpCircle, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { loadPreferences } from "@/lib/preferences";

interface SidebarNavProps {
  username?: string | null;
}

const NAV_ITEMS = [
  { href: "/garage", icon: Car, label: "Garage", shortcut: "G" },
  { href: "/cards", icon: GalleryHorizontal, label: "Cards", shortcut: "" },
  { href: "/feed", icon: Globe, label: "Feed", shortcut: "" },
  { href: "/achievements", icon: Trophy, label: "Achievements", shortcut: "" },
  { href: "/visualizer", icon: Zap, label: "Visualizer", shortcut: "V" },
  { href: "/chat", icon: MessageSquare, label: "AI Chat", shortcut: "C" },
  { href: "/forum", icon: Sparkles, label: "Forum", shortcut: "" },
  { href: "/stats", icon: BarChart2, label: "Stats", shortcut: "S" },
  { href: "/notifications", icon: Bell, label: "Notifications", shortcut: "" },
  { href: "/how-it-works", icon: HelpCircle, label: "How It Works", shortcut: "" },
];

export function SidebarNav({ username }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [side, setSide] = useState<"left" | "right">("left");

  useEffect(() => {
    const prefs = loadPreferences();
    setSide(prefs.sidebarSide ?? "left");
    function onStorage(e: StorageEvent) {
      if (e.key?.includes("modvault")) setSide(loadPreferences().sidebarSide ?? "left");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <>
      <style>{`
        .sidebar-nav { width: 56px; transition: width 200ms ease; overflow: hidden; }
        .sidebar-nav:hover { width: 256px; }
        .sidebar-label {
          opacity: 0; overflow: hidden; white-space: nowrap;
          transition: opacity 120ms ease; flex: 1;
        }
        .sidebar-nav:hover .sidebar-label { opacity: 1; }
        .sidebar-logo-text {
          opacity: 0; overflow: hidden; white-space: nowrap;
          transition: opacity 120ms ease;
        }
        .sidebar-nav:hover .sidebar-logo-text { opacity: 1; }
        .sidebar-kbd { display: none; }
        .sidebar-nav:hover .sidebar-kbd { display: inline-flex; }
        .sidebar-user-info { display: none; }
        .sidebar-nav:hover .sidebar-user-info { display: block; }
        .sidebar-settings-text { display: none; }
        .sidebar-nav:hover .sidebar-settings-text { display: inline; }
        .sidebar-signout-text { display: none; }
        .sidebar-nav:hover .sidebar-signout-text { display: inline; }
      `}</style>
      <aside className={`sidebar-nav hidden lg:flex fixed top-0 bottom-0 z-40 flex-col glass ${
        side === "right"
          ? "right-0 border-l border-[var(--color-border)]"
          : "left-0 border-r border-[var(--color-border)]"
      }`}>
        {/* Logo */}
        <div className="px-3 pt-4 pb-6" style={{ minWidth: 56 }}>
          <Link href="/garage" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span className="sidebar-logo-text font-black text-sm tracking-[0.2em] text-gradient-blue uppercase">MODVAULT</span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2" aria-label="Main navigation">
          <div className="space-y-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label, shortcut }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all relative",
                    active
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)]"
                      : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-elevated)]"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full" />
                  )}
                  <Icon size={18} strokeWidth={active ? 2.5 : 1.75} className="flex-shrink-0" />
                  <span className="sidebar-label text-sm font-bold">{label}</span>
                  {shortcut && (
                    <kbd className={cn(
                      "sidebar-kbd text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors flex-shrink-0",
                      active
                        ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-bright)]"
                        : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
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
        <div className="p-2 border-t border-[var(--color-border)]">
          <Link
            href="/profile"
            title="Profile"
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-white uppercase">{username?.[0] ?? "U"}</span>
            </div>
            <div className="sidebar-user-info flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">@{username ?? "user"}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <User size={9} /> Profile
              </p>
            </div>
          </Link>
          <Link
            href="/settings"
            title="Settings"
            className={cn(
              "w-full mt-1 flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors text-xs font-bold cursor-pointer",
              pathname.startsWith("/settings")
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
            )}
          >
            <Settings size={16} className="flex-shrink-0" />
            <span className="sidebar-settings-text">Settings</span>
          </Link>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-full mt-1 flex items-center gap-3 px-2.5 py-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors text-xs font-bold cursor-pointer"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span className="sidebar-signout-text">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

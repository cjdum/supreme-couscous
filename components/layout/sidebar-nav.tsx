"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, Clock, Users, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  username?: string | null;
}

const NAV_ITEMS = [
  { href: "/home",      icon: Home,     label: "Home"      },
  { href: "/mint",      icon: Sparkles, label: "Mint"      },
  { href: "/timeline",  icon: Clock,    label: "Timeline"  },
  { href: "/community", icon: Users,    label: "Community" },
  { href: "/profile",   icon: User,     label: "Profile"   },
];

export function SidebarNav({ username: _username }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <>
      <style>{`
        .sidebar-nav { width: 56px; transition: width 200ms ease; overflow: hidden; }
        .sidebar-nav:hover { width: 240px; }
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
        .sidebar-signout-text { display: none; }
        .sidebar-nav:hover .sidebar-signout-text { display: inline; }
      `}</style>

      <aside className="sidebar-nav hidden lg:flex fixed top-0 bottom-0 left-0 z-40 flex-col glass border-r border-[var(--color-border)]">

        {/* Logo */}
        <div className="px-3 pt-4 pb-6" style={{ minWidth: 56 }}>
          <Link href="/home" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span className="sidebar-logo-text font-black text-sm tracking-[0.2em] text-gradient-blue uppercase">
              MODVAULT
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2" aria-label="Main navigation">
          <div className="space-y-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
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
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.5 : 1.75}
                    className="flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sidebar-label text-sm font-bold">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sign out */}
        <div className="p-2 border-t border-[var(--color-border)]">
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors text-xs font-bold cursor-pointer"
          >
            <LogOut size={16} className="flex-shrink-0" aria-hidden="true" />
            <span className="sidebar-signout-text">Sign out</span>
          </button>
        </div>

      </aside>
    </>
  );
}

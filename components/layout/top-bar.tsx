"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

interface TopBarProps {
  username?: string | null;
}

export function TopBar({ username }: TopBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-[var(--color-border)] h-14">
      <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/garage" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm group-hover:scale-105 transition-transform">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 9l2-5h6l2 5H2z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="4.5" cy="10" r="1" fill="white" />
              <circle cx="9.5" cy="10" r="1" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-wider text-gradient-blue">
            MODVAULT
          </span>
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <User size={14} className="text-[var(--color-text-secondary)]" />
            {username && (
              <span className="text-xs font-medium text-[var(--color-text-secondary)] hidden sm:block">
                {username}
              </span>
            )}
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-10 z-20 w-48 rounded-[12px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-2xl overflow-hidden animate-in">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <div className="border-t border-[var(--color-border)]" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.08)] transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Settings, LogOut } from "lucide-react";
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
    window.location.href = "/";
  }

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 glass border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between h-full px-5 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/garage" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm group-hover:scale-105 transition-transform duration-200">
            <svg width="17" height="17" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="4.5" cy="10" r="1" fill="white" />
              <circle cx="9.5" cy="10" r="1" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-[13px] tracking-[0.2em] text-gradient-blue uppercase hidden sm:block">
            MODVAULT
          </span>
        </Link>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 h-9 px-3.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all cursor-pointer"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center">
              {username ? (
                <span className="text-[10px] font-bold text-white uppercase">{username[0]}</span>
              ) : (
                <User size={12} className="text-white" />
              )}
            </div>
            {username && (
              <span className="text-xs font-medium text-[var(--color-text-secondary)] hidden sm:block max-w-[100px] truncate">
                {username}
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">@{username}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  <Settings size={14} />
                  Profile & Settings
                </Link>
                <div className="border-t border-[var(--color-border)]" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer"
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

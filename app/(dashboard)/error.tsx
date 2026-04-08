"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full text-center rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-10">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[rgba(255,69,58,0.12)] border border-[rgba(255,69,58,0.4)] flex items-center justify-center">
          <AlertTriangle size={24} className="text-[#ff453a]" />
        </div>
        <h2 className="text-xl font-black tracking-tight mb-2 text-[var(--color-text-primary)]">
          This page hit a snag
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Try refreshing. If it keeps happening, check your connection.
        </p>
        {error.digest && (
          <p className="text-[10px] mb-6 text-[var(--color-text-muted)] font-mono">
            ref: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
          <Link
            href="/garage"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
          >
            <Home size={14} />
            Garage
          </Link>
        </div>
      </div>
    </div>
  );
}

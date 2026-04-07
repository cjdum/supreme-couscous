"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2, X, DollarSign } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface WishlistPlannerProps {
  carId: string;
  wishlistCount: number;
}

/**
 * Feature 17 — AI build planner. Streams a phased install path for the
 * user's wishlist mods, optionally seeded with a monthly savings budget.
 */
export function WishlistPlanner({ carId, wishlistCount }: WishlistPlannerProps) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState<string>("");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runPlan() {
    if (planning) return;
    setPlanning(true);
    setPlan("");
    setError(null);
    haptic("medium");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const monthlyBudget = budget.trim() ? parseInt(budget, 10) : undefined;
      const res = await fetch("/api/ai/plan-wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: carId,
          ...(monthlyBudget && monthlyBudget > 0 ? { monthly_budget: monthlyBudget } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // JSON error path
        let errMsg = "Failed to plan";
        try {
          const j = await res.json();
          errMsg = j.error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setPlan((prev) => prev + decoder.decode(value, { stream: true }));
      }
      haptic("success");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Plan failed");
    } finally {
      setPlanning(false);
      abortRef.current = null;
    }
  }

  function close() {
    abortRef.current?.abort();
    setOpen(false);
    setPlan("");
    setError(null);
    setPlanning(false);
  }

  if (wishlistCount === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          haptic("light");
        }}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[#60A5FA] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-[0_4px_16px_rgba(59,130,246,0.3)]"
      >
        <Sparkles size={12} /> Plan my build
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-2xl max-h-[90dvh] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col tactile">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-muted)] flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-[var(--color-accent-bright)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight">Build Planner</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                    Phased install path for your {wishlistCount} wishlist {wishlistCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-elevated)] cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
              {/* Budget input — shown before planning starts */}
              {!plan && !planning && (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 block">
                      Monthly savings (optional)
                    </label>
                    <div className="relative">
                      <DollarSign
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g. 300"
                        min="0"
                        max="100000"
                        className="w-full pl-9"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
                      Add a monthly budget and I&apos;ll tell you when each phase becomes affordable.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={runPlan}
                    className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-[0_8px_32px_rgba(59,130,246,0.3)]"
                  >
                    <Sparkles size={14} /> Plan my build
                  </button>
                </>
              )}

              {/* Streaming output */}
              {(planning || plan) && (
                <div className="rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4 sm:p-5">
                  {planning && plan.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <Loader2 size={13} className="animate-spin text-[var(--color-accent-bright)]" />
                      Planning your build…
                    </div>
                  )}
                  {plan && (
                    <pre className="text-xs sm:text-[13px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap font-sans">
                      {plan}
                      {planning && <span className="inline-block w-1 h-3 ml-0.5 bg-[var(--color-accent-bright)] animate-pulse align-middle" />}
                    </pre>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
                  {error}
                </div>
              )}

              {plan && !planning && (
                <button
                  type="button"
                  onClick={runPlan}
                  className="w-full h-11 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-all cursor-pointer"
                >
                  Re-plan with different budget
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

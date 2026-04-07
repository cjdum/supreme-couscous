"use client";

import { useState } from "react";
import { Star, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";

interface SetPrimaryButtonProps {
  carId: string;
  isPrimary?: boolean;
  variant?: "compact" | "prominent";
}

export function SetPrimaryButton({ carId, isPrimary, variant = "compact" }: SetPrimaryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (isPrimary) {
    if (variant === "prominent") {
      return (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "rgba(251,191,36,0.18)",
            color: "#fbbf24",
            border: "1px solid rgba(251,191,36,0.40)",
          }}
        >
          <Star size={9} fill="currentColor" /> Primary
        </div>
      );
    }
    return null;
  }

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    haptic("medium");
    try {
      const res = await fetch("/api/cars/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      });
      if (res.ok) {
        setSuccess(true);
        haptic("success");
        // brief success state, then refresh — gives the user satisfying feedback
        setTimeout(() => {
          router.refresh();
        }, 400);
      }
    } finally {
      // We intentionally don't reset loading — the page will refresh.
    }
  }

  if (variant === "prominent") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || success}
        aria-label="Set as primary car"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer hover:scale-110 active:scale-95 disabled:opacity-100 group"
        style={{
          background: success
            ? "rgba(48,209,88,0.95)"
            : "linear-gradient(135deg, rgba(251,191,36,0.95), rgba(251,191,36,0.75))",
          backdropFilter: "blur(8px)",
          color: success ? "#fff" : "#000",
          border: success
            ? "1px solid rgba(48,209,88,1)"
            : "1px solid rgba(251,191,36,0.85)",
          boxShadow: success
            ? "0 4px 24px rgba(48,209,88,0.45)"
            : "0 4px 20px rgba(251,191,36,0.35)",
          transform: success ? "scale(1.08)" : undefined,
        }}
      >
        {loading ? (
          <Loader2 size={10} className="animate-spin" />
        ) : success ? (
          <Check size={11} strokeWidth={3.5} />
        ) : (
          <Star size={10} fill="currentColor" className="group-hover:rotate-12 transition-transform" />
        )}
        {success ? "Primary!" : "Make Primary"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || success}
      aria-label="Set as primary car"
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-60"
      style={{
        backgroundColor: success ? "rgba(48,209,88,0.18)" : "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        color: success ? "#30d158" : "rgba(255,255,255,0.7)",
        border: success
          ? "1px solid rgba(48,209,88,0.30)"
          : "1px solid rgba(255,255,255,0.18)",
      }}
    >
      {loading ? (
        <Loader2 size={9} className="animate-spin" />
      ) : success ? (
        <Check size={9} />
      ) : (
        <Star size={9} />
      )}
      {success ? "Primary!" : "Make Primary"}
    </button>
  );
}

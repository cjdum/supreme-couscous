"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface LikeButtonProps {
  carId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
}

/**
 * Feature 19 — optimistic heart button that toggles the current user's like
 * on a public build. Falls back to its prior state if the request fails.
 */
export function LikeButton({ carId, initialLiked, initialCount, size = "md" }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    haptic(nextLiked ? "medium" : "light");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/cars/${carId}/like`, {
          method: nextLiked ? "POST" : "DELETE",
        });
        if (!res.ok) throw new Error("Like failed");
        const json = (await res.json()) as { liked: boolean; count: number };
        setLiked(json.liked);
        setCount(json.count);
      } catch {
        setLiked(!nextLiked);
        setCount((c) => c + (nextLiked ? -1 : 1));
      }
    });
  }

  const sizes = {
    sm: { pill: "h-8 px-3 text-[11px]", icon: 12 },
    md: { pill: "h-10 px-4 text-xs", icon: 14 },
  }[size];

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 ${sizes.pill} rounded-xl font-bold cursor-pointer transition-all ${
        liked
          ? "bg-[rgba(255,69,58,0.12)] border border-[rgba(255,69,58,0.28)] text-[#ff6b62]"
          : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)]"
      }`}
      aria-pressed={liked}
      aria-label={liked ? "Unlike build" : "Like build"}
    >
      <Heart
        size={sizes.icon}
        fill={liked ? "#ff6b62" : "none"}
        className={liked ? "scale-110" : ""}
      />
      <span className="tabular">{count}</span>
    </button>
  );
}

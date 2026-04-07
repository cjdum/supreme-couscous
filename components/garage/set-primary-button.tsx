"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface SetPrimaryButtonProps {
  carId: string;
  isPrimary?: boolean;
}

export function SetPrimaryButton({ carId, isPrimary }: SetPrimaryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (isPrimary) return null;

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await fetch("/api/cars/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label="Set as primary car"
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
      style={{
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        color: "rgba(255,255,255,0.5)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {loading ? (
        <Loader2 size={9} className="animate-spin" />
      ) : (
        <Star size={9} />
      )}
      Set Primary
    </button>
  );
}

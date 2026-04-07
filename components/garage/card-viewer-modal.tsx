"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { TradingCard } from "./trading-card";
import { calculateRarityFromScore, type PixelCardRarity } from "@/lib/pixel-card";
import type { Car } from "@/lib/supabase/types";

interface CardViewerModalProps {
  car: Car;
  onClose: () => void;
}

export function CardViewerModal({ car, onClose }: CardViewerModalProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!car.pixel_card_url || !car.pixel_card_nickname) return null;

  const rarity: PixelCardRarity =
    (car.pixel_card_rarity as PixelCardRarity) ??
    calculateRarityFromScore(car.pixel_card_build_score ?? 0);

  const carLabel = `${car.year} ${car.make} ${car.model}`;

  function handleShare() {
    const url = `${window.location.origin}/u/`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pixel card for ${carLabel}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        background: "rgba(4,4,12,0.92)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        animation: "fadeIn 0.25s ease-out",
        cursor: "pointer",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .cv-card { animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; cursor: default; }
      `}</style>

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close card viewer"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 9991,
        }}
      >
        <X size={16} />
      </button>

      {/* Card */}
      <div className="cv-card" onClick={(e) => e.stopPropagation()}>
        <TradingCard
          cardUrl={car.pixel_card_url}
          nickname={car.pixel_card_nickname}
          generatedAt={car.pixel_card_generated_at}
          hp={car.pixel_card_hp}
          modCount={car.pixel_card_mod_count}
          buildScore={car.pixel_card_build_score}
          rarity={rarity}
          vinVerified={car.vin_verified}
          carLabel={carLabel}
          idle
          interactive
          showShare
          onShare={handleShare}
        />
      </div>

      <p
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Click outside to close
      </p>
    </div>
  );
}

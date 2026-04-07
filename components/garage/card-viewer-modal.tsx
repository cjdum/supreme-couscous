"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Calendar, Hash } from "lucide-react";
import { TradingCard } from "./trading-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CardViewerModalProps {
  /** All cards for this car, ordered oldest → newest (edition 1, 2, ...) */
  cards: MintedCard[];
  /** Full car label e.g. "2018 Subaru WRX STI" */
  carLabel: string;
  /** Index to start on (defaults to most recent) */
  startIndex?: number;
  onClose: () => void;
}

export function CardViewerModal({
  cards,
  carLabel,
  startIndex,
  onClose,
}: CardViewerModalProps) {
  const initial = startIndex ?? cards.length - 1;
  const [idx, setIdx] = useState(Math.max(0, Math.min(initial, cards.length - 1)));
  const [copied, setCopied] = useState(false);

  const card = cards[idx];

  // Close on Escape, arrows for navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) setIdx((i) => i - 1);
      if (e.key === "ArrowRight" && idx < cards.length - 1) setIdx((i) => i + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, idx, cards.length]);

  if (!card) return null;

  function handleShare() {
    const url = `${window.location.origin}/cards/${card.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const snap = card.car_snapshot;
  const mintedDate = new Date(card.minted_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
        background: "rgba(4,4,12,0.94)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "80px 20px 40px",
        animation: "cvFade 0.25s ease-out",
        cursor: "pointer",
        overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes cvFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cvSlide { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .cv-card { animation: cvSlide 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; cursor: default; }
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

      {/* Edition indicator */}
      {cards.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "rgba(245,215,110,0.8)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 800,
          }}
        >
          Edition {idx + 1} / {cards.length}
        </div>
      )}

      {/* Card with nav arrows */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}
      >
        {cards.length > 1 && (
          <button
            onClick={() => idx > 0 && setIdx(idx - 1)}
            disabled={idx === 0}
            aria-label="Previous edition"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: idx === 0 ? "not-allowed" : "pointer",
              opacity: idx === 0 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <div className="cv-card" style={{ width: 280 * 1.5, height: 380 * 1.5 }}>
          <TradingCard
            cardUrl={card.pixel_card_url}
            nickname={card.nickname}
            generatedAt={card.minted_at}
            hp={card.hp}
            modCount={card.mod_count}
            buildScore={snap.build_score}
            vinVerified={snap.vin_verified}
            carLabel={carLabel}
            scale={1.5}
            idle
            interactive
            showShare
            onShare={handleShare}
          />
        </div>

        {cards.length > 1 && (
          <button
            onClick={() => idx < cards.length - 1 && setIdx(idx + 1)}
            disabled={idx === cards.length - 1}
            aria-label="Next edition"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: idx === cards.length - 1 ? "not-allowed" : "pointer",
              opacity: idx === cards.length - 1 ? 0.3 : 1,
            }}
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {copied && (
        <div
          style={{
            position: "fixed",
            top: 76,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(48,209,88,0.15)",
            border: "1px solid rgba(48,209,88,0.4)",
            color: "#30d158",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            zIndex: 9992,
          }}
        >
          Copied!
        </div>
      )}

      {/* Snapshot details */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          marginTop: 8,
          padding: "16px 20px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          cursor: "default",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={11} className="text-[#f5d76e]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(245,215,110,0.85)]">
            Minted {mintedDate}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/35 mb-0.5">Color</p>
            <p className="text-xs font-semibold text-white/80">{snap.color ?? "—"}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/35 mb-0.5">Trim</p>
            <p className="text-xs font-semibold text-white/80">{snap.trim ?? "—"}</p>
          </div>
        </div>

        {snap.mods && snap.mods.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash size={10} className="text-white/40" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                Mods in this snapshot ({snap.mods.length})
              </p>
            </div>
            <ul className="space-y-1">
              {snap.mods.slice(0, 8).map((m, i) => (
                <li key={i} className="text-[11px] text-white/70 leading-snug">
                  • {m}
                </li>
              ))}
              {snap.mods.length > 8 && (
                <li className="text-[10px] text-white/35 italic">
                  +{snap.mods.length - 8} more
                </li>
              )}
            </ul>
          </div>
        )}

        {snap.description && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">
              Story
            </p>
            <p className="text-[11px] text-white/65 leading-relaxed whitespace-pre-wrap">
              {snap.description}
            </p>
          </div>
        )}
      </div>

      <p
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginTop: 4,
        }}
      >
        {cards.length > 1 ? "← → to navigate · " : ""}Click outside to close
      </p>
    </div>
  );
}

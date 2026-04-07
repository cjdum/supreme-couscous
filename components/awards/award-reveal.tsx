"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { AWARDS_BY_ID, RARITY_STYLES, type AwardDef } from "@/lib/awards";
import { BADGE_ICON_PATHS } from "@/lib/badges";
import { ConfettiBurst } from "@/components/ui/confetti";
import { haptic } from "@/lib/haptics";

interface AwardRevealProps {
  awardIds: string[];
  onClose: () => void;
}

/**
 * Feature 16 — Balatro-style award reveal modal.
 *
 * Stages a sequential reveal: each award's card flips in with rarity glow,
 * the rarity label slides up, then advances to the next. Legendary unlocks
 * trigger a confetti burst on top of the standard glow treatment.
 */
export function AwardReveal({ awardIds, onClose }: AwardRevealProps) {
  const [index, setIndex] = useState(0);
  const [confetti, setConfetti] = useState<number | null>(null);

  const awards: AwardDef[] = awardIds
    .map((id) => AWARDS_BY_ID[id])
    .filter((a): a is AwardDef => Boolean(a));

  const current = awards[index];

  useEffect(() => {
    if (!current) return;
    haptic(current.rarity === "legendary" ? "success" : "medium");
    if (current.rarity === "legendary" || current.rarity === "epic") {
      setConfetti(Date.now());
    }
  }, [current]);

  if (!current) return null;

  const style = RARITY_STYLES[current.rarity];
  const path = BADGE_ICON_PATHS[current.icon];
  const isLast = index === awards.length - 1;

  function next() {
    haptic("light");
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ConfettiBurst trigger={confetti} />

      {/* Counter pill (e.g. "1 of 3") */}
      {awards.length > 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/8 border border-white/12 text-[10px] font-bold uppercase tracking-wider text-white/70">
          {index + 1} of {awards.length}
        </div>
      )}

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 w-11 h-11 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 cursor-pointer"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <div className="relative w-full max-w-sm">
        {/* "AWARD UNLOCKED" banner */}
        <div
          className="text-center mb-5"
          style={{ animation: "awardSlideDown 500ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/8 border border-white/15">
            <Sparkles size={12} style={{ color: style.color }} />
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: style.color }}
            >
              Award Unlocked
            </span>
          </div>
        </div>

        {/* Award card */}
        <div
          key={current.id}
          className="rounded-3xl p-8 text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${style.bg}, rgba(15,17,21,0.95))`,
            border: `1px solid ${style.border}`,
            boxShadow: style.glow,
            animation:
              "awardCardFlip 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          {/* Rarity tag */}
          <div
            className="inline-block px-3 py-1 rounded-full mb-6"
            style={{
              background: `${style.color}18`,
              border: `1px solid ${style.color}40`,
            }}
          >
            <span
              className="text-[9px] font-black uppercase tracking-[0.18em]"
              style={{ color: style.color }}
            >
              {style.label}
            </span>
          </div>

          {/* Icon */}
          <div
            className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-5 relative"
            style={{
              background: `${style.color}10`,
              border: `1px solid ${style.color}30`,
            }}
          >
            {path && (
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke={style.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={path} />
              </svg>
            )}
            {/* Pulsing halo for epic+legendary */}
            {(current.rarity === "epic" || current.rarity === "legendary") && (
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow: `0 0 40px ${style.color}66`,
                  animation: "awardHalo 2s ease-in-out infinite",
                }}
              />
            )}
          </div>

          {/* Name */}
          <h2 className="text-2xl font-black tracking-tight text-white mb-1.5">
            {current.name}
          </h2>

          {/* Description */}
          <p className="text-xs text-white/65 mb-3">{current.description}</p>

          {/* Flavor */}
          <p
            className="text-[11px] italic"
            style={{ color: `${style.color}cc` }}
          >
            &ldquo;{current.flavor}&rdquo;
          </p>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={next}
          className="w-full mt-5 h-12 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all hover:brightness-110"
          style={{
            background: `linear-gradient(135deg, ${style.color}, ${style.color}cc)`,
            boxShadow: `0 8px 32px ${style.color}55`,
          }}
        >
          {isLast ? "Sweet" : "Next Award"}
        </button>
      </div>

      <style jsx>{`
        @keyframes awardCardFlip {
          0% {
            opacity: 0;
            transform: perspective(1200px) rotateY(-90deg) scale(0.85);
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: perspective(1200px) rotateY(0deg) scale(1);
          }
        }
        @keyframes awardSlideDown {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes awardHalo {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { Share2, ShieldCheck } from "lucide-react";
import { RARITY_CONFIG, type PixelCardRarity } from "@/lib/pixel-card";

export type { PixelCardRarity };

export interface TradingCardData {
  cardUrl: string;
  nickname: string;
  generatedAt: string | null;
  hp: number | null;
  modCount: number | null;
  buildScore: number | null;
  rarity: PixelCardRarity;
  vinVerified?: boolean;
}

interface TradingCardProps extends TradingCardData {
  /** Full car label e.g. "2018 Subaru WRX STI" */
  carLabel: string;
  /** Enable idle float animation (default true) */
  idle?: boolean;
  /** Enable 3D mouse-tilt + holographic shimmer (default true) */
  interactive?: boolean;
  /** Show share button on hover (default false) */
  showShare?: boolean;
  /** Called when share button clicked */
  onShare?: () => void;
}

// Card layout constants
const CARD_W  = 280;
const HEADER_H = 40;   // car name + year
const ART_H    = 220;  // pixel art window
const STATS_H  = 120;  // stats panel
const FOOTER_H = 40;   // nickname + rarity badge
const CARD_H   = HEADER_H + ART_H + STATS_H + FOOTER_H; // 420

// Pixel-grid pattern for art window
const GRID_BG = [
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 4px)",
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 4px)",
  "linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 50%, #0d0d1a 100%)",
].join(", ");

export function TradingCard({
  cardUrl,
  nickname,
  generatedAt,
  hp,
  modCount,
  buildScore,
  rarity,
  vinVerified = false,
  carLabel,
  idle = true,
  interactive = true,
  showShare = false,
  onShare,
}: TradingCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, over: false });
  const rafRef     = useRef(0);

  const rc = RARITY_CONFIG[rarity] ?? RARITY_CONFIG.STOCK;

  // Parse year out of carLabel (last piece is year if it looks like a 4-digit number after split)
  const labelParts = carLabel.split(" ");
  const yearMatch  = labelParts[0]?.match(/^\d{4}$/);
  const yearStr    = yearMatch ? labelParts[0] : "";
  const nameStr    = yearMatch ? labelParts.slice(1).join(" ") : carLabel;

  const mintDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", {
        month: "2-digit",
        day:   "2-digit",
        year:  "2-digit",
      })
    : "--/--/--";

  // ── 3D tilt via RAF (zero re-renders) ────────────────────────────────────
  function scheduleTilt() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!wrapperRef.current || !pointerRef.current.over) return;
      const { x, y } = pointerRef.current;
      const rx = (y - 0.5) * -12;
      const ry = (x - 0.5) * 12;
      wrapperRef.current.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      if (shimmerRef.current) {
        shimmerRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 45%, transparent 65%)`;
        shimmerRef.current.style.opacity = "1";
      }
      if (pointerRef.current.over) scheduleTilt();
    });
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      over: true,
    };
    scheduleTilt();
  }

  function onMouseLeave() {
    if (!interactive) return;
    pointerRef.current.over = false;
    if (wrapperRef.current) {
      wrapperRef.current.style.transition = "transform 0.55s cubic-bezier(0.23,1,0.32,1)";
      wrapperRef.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
      setTimeout(() => {
        if (wrapperRef.current) wrapperRef.current.style.transition = "";
      }, 550);
    }
    if (shimmerRef.current) {
      shimmerRef.current.style.transition = "opacity 0.35s";
      shimmerRef.current.style.opacity = "0";
      setTimeout(() => {
        if (shimmerRef.current) {
          shimmerRef.current.style.transition = "";
          shimmerRef.current.style.background = "";
        }
      }, 350);
    }
  }

  const isLegend = rarity === "LEGEND";

  return (
    <div style={{ width: CARD_W, height: CARD_H, position: "relative" }}>
      <style>{`
        @keyframes cardFloat {
          0%,100% { transform: perspective(900px) translateY(0px) rotate(-0.3deg); }
          50%      { transform: perspective(900px) translateY(-6px) rotate(0.3deg); }
        }
        @keyframes legendPulse {
          0%,100% { box-shadow: 0 0 20px rgba(245,215,110,0.35), 0 8px 32px rgba(0,0,0,0.7); }
          50%      { box-shadow: 0 0 36px rgba(245,215,110,0.55), 0 8px 32px rgba(0,0,0,0.7); }
        }
        .tc-idle {
          animation: cardFloat 3.2s ease-in-out infinite;
        }
        .tc-idle.tc-legend {
          animation: cardFloat 3.2s ease-in-out infinite, legendPulse 2.4s ease-in-out infinite;
        }
        .tc-idle:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .tc-idle, .tc-idle.tc-legend { animation: none !important; }
        }
      `}</style>

      <div
        ref={wrapperRef}
        className={idle ? `tc-idle${isLegend ? " tc-legend" : ""}` : ""}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 16,
          border: `2px solid ${rc.borderColor}`,
          boxShadow: isLegend
            ? `0 0 20px ${rc.glow}, 0 8px 32px rgba(0,0,0,0.7)`
            : `0 0 12px ${rc.glow}, 0 8px 32px rgba(0,0,0,0.6)`,
          backgroundColor: "#0d0d1a",
          position: "relative",
          overflow: "hidden",
          transformStyle: "preserve-3d",
          willChange: "transform",
          cursor: interactive ? "default" : "pointer",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Holographic shimmer layer ──────────────────────────────────── */}
        <div
          ref={shimmerRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 30,
            mixBlendMode: "overlay",
            opacity: 0,
            borderRadius: 14,
          }}
        />

        {/* ── Top rarity glow strip ──────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent 0%, ${rc.color} 35%, ${rc.color} 65%, transparent 100%)`,
            opacity: 0.9,
            zIndex: 10,
          }}
        />

        {/* ── HEADER (40px): car name left, year right ──────────────────── */}
        <div
          style={{
            height: HEADER_H,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            background: "#08080f",
            borderBottom: `1px solid ${rc.borderColor}28`,
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.55)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
              flex: 1,
              marginRight: 8,
            }}
          >
            {nameStr}
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 9,
              fontWeight: 700,
              color: rc.color,
              opacity: 0.9,
              flexShrink: 0,
            }}
          >
            {yearStr}
          </div>
        </div>

        {/* ── ART WINDOW (220px): pixel art + VIN badge + MODVAULT mark ─── */}
        <div
          style={{
            height: ART_H,
            flexShrink: 0,
            position: "relative",
            backgroundImage: GRID_BG,
            backgroundRepeat: "repeat",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardUrl}
            alt={nickname}
            width={200}
            height={160}
            style={{
              width: 200,
              height: 160,
              objectFit: "contain",
              imageRendering: "pixelated",
              zIndex: 2,
              position: "relative",
            }}
          />

          {/* VIN verified badge — top-right of art window */}
          {vinVerified && (
            <div
              title="VIN Verified via NHTSA"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "3px 7px",
                borderRadius: 5,
                background: "rgba(245,215,110,0.12)",
                border: "1px solid rgba(245,215,110,0.5)",
                backdropFilter: "blur(4px)",
                zIndex: 5,
              }}
            >
              <ShieldCheck size={8} style={{ color: "#f5d76e" }} />
              <span style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 7,
                fontWeight: 900,
                letterSpacing: "0.15em",
                color: "#f5d76e",
                textTransform: "uppercase" as const,
              }}>
                VIN
              </span>
            </div>
          )}

          {/* MODVAULT watermark — bottom-left of art window */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 10,
              fontFamily: "ui-monospace, monospace",
              fontSize: 6,
              fontWeight: 900,
              letterSpacing: "0.25em",
              color: `${rc.color}44`,
              userSelect: "none",
              zIndex: 3,
            }}
          >
            MODVAULT
          </div>
        </div>

        {/* ── STATS PANEL (120px) ────────────────────────────────────────── */}
        <div
          style={{
            height: STATS_H,
            flexShrink: 0,
            background: "#08080f",
            borderTop: `1px solid ${rc.borderColor}22`,
            borderBottom: `1px solid ${rc.borderColor}22`,
            padding: "12px 14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Two-column stats: PWR + SCORE left, MODS + MINT right */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "PWR",   value: hp != null ? `${hp} hp` : "—" },
                { label: "SCORE", value: buildScore != null ? String(buildScore) : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 7,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.28)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase" as const,
                    marginBottom: 2,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.85)",
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Vertical divider */}
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                left: -4,
                top: 0,
                bottom: 0,
                width: 1,
                background: `${rc.borderColor}28`,
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
                {[
                  { label: "MODS",  value: modCount != null ? String(modCount) : "—" },
                  { label: "MINT",  value: mintDate },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 7,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.28)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase" as const,
                      marginBottom: 2,
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.85)",
                    }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full-width rarity bar */}
          <div style={{
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: "100%",
              background: `linear-gradient(90deg, ${rc.borderColor} 0%, ${rc.color} 100%)`,
              opacity: 0.8,
            }} />
          </div>
        </div>

        {/* ── FOOTER (40px): nickname centered + rarity badge right ─────── */}
        <div
          style={{
            height: FOOTER_H,
            flexShrink: 0,
            background: "#08080f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            position: "relative",
          }}
        >
          {/* Nickname — centered in the card */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              fontWeight: 900,
              color: "#f5d76e",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
              maxWidth: 170,
            }}>
              {nickname}
            </span>
          </div>

          {/* Rarity badge — far right */}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, zIndex: 2 }}>
            {showShare && onShare && (
              <button
                onClick={(e) => { e.stopPropagation(); onShare(); }}
                title="Share card"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.3)",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Share2 size={10} />
              </button>
            )}
            <div style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 7,
              fontWeight: 900,
              letterSpacing: "0.2em",
              textTransform: "uppercase" as const,
              color: rc.color,
              background: `${rc.color}14`,
              border: `1px solid ${rc.color}45`,
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              {rc.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { Share2, ShieldCheck } from "lucide-react";
import { CARD_BORDER_COLOR, CARD_BORDER_GLOW, CARD_GOLD } from "@/lib/pixel-card";

export interface TradingCardData {
  cardUrl: string;
  nickname: string;
  generatedAt: string | null;
  hp: number | null;
  modCount: number | null;
  buildScore: number | null;
  vinVerified?: boolean;
}

interface TradingCardProps extends TradingCardData {
  /** Full car label e.g. "2018 Subaru WRX STI" */
  carLabel: string;
  /** Optional scale multiplier (default 1) — useful for collection thumbnails */
  scale?: number;
  /** Enable idle float animation (default true) */
  idle?: boolean;
  /** Enable 3D mouse-tilt + holographic shimmer (default true) */
  interactive?: boolean;
  /** Show share button (default false) */
  showShare?: boolean;
  /** Called when share button clicked */
  onShare?: () => void;
}

// Card layout constants — uniform for ALL cards
const CARD_W   = 280;
const HEADER_H = 36;   // make+model + year
const ART_H    = 220;  // pixel art window
const STATS_H  = 84;   // stats grid + divider
const FOOTER_H = 40;   // nickname centered
const CARD_H   = HEADER_H + ART_H + STATS_H + FOOTER_H; // 380

// Pixel-grid background pattern
const GRID_BG = [
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 4px)",
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 4px)",
  "linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 100%)",
].join(", ");

// Iridescent rainbow gradient for shimmer overlay
const SHIMMER_RAINBOW =
  "conic-gradient(from 0deg, rgba(255,80,80,0.5), rgba(255,200,80,0.5), rgba(80,255,140,0.5), rgba(80,180,255,0.5), rgba(200,80,255,0.5), rgba(255,80,80,0.5))";

export function TradingCard({
  cardUrl,
  nickname,
  generatedAt,
  hp,
  modCount,
  buildScore,
  vinVerified = false,
  carLabel,
  scale = 1,
  idle = true,
  interactive = true,
  showShare = false,
  onShare,
}: TradingCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, over: false });
  const rafRef     = useRef(0);

  // Parse year out of carLabel (first piece if it's a 4-digit year)
  const parts     = carLabel.split(" ");
  const yearMatch = parts[0]?.match(/^\d{4}$/);
  const yearStr   = yearMatch ? parts[0] : "";
  const nameStr   = yearMatch ? parts.slice(1).join(" ") : carLabel;

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
      const rx = (y - 0.5) * -15;
      const ry = (x - 0.5) * 15;
      wrapperRef.current.style.transform = `perspective(900px) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      if (shimmerRef.current) {
        // Iridescent rainbow that shifts dramatically with mouse position
        const angle = Math.round((x + y) * 360);
        shimmerRef.current.style.background = `
          radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 25%, transparent 60%),
          ${SHIMMER_RAINBOW}
        `;
        shimmerRef.current.style.transform = `rotate(${angle}deg)`;
        shimmerRef.current.style.opacity = "0.25";
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
      wrapperRef.current.style.transform = `perspective(900px) scale(${scale}) rotateX(0deg) rotateY(0deg)`;
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
        }
      }, 350);
    }
  }

  return (
    <div
      style={{
        width: CARD_W * scale,
        height: CARD_H * scale,
        position: "relative",
        // Container reserves the post-scale footprint
      }}
    >
      <style>{`
        @keyframes cardFloat {
          0%,100% { transform: perspective(900px) scale(${scale}) translateY(0px) rotate(-0.4deg); }
          50%      { transform: perspective(900px) scale(${scale}) translateY(-4px) rotate(0.4deg); }
        }
        .tc-idle-${scale.toString().replace(".", "_")} {
          animation: cardFloat 3.4s ease-in-out infinite;
        }
        .tc-idle-${scale.toString().replace(".", "_")}:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-idle-${scale.toString().replace(".", "_")} { animation: none !important; }
        }
      `}</style>

      <div
        ref={wrapperRef}
        className={idle ? `tc-idle-${scale.toString().replace(".", "_")}` : ""}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          width: CARD_W,
          height: CARD_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          borderRadius: 16,
          border: `2px solid ${CARD_BORDER_COLOR}`,
          boxShadow: `0 0 18px ${CARD_BORDER_GLOW}, 0 8px 32px rgba(0,0,0,0.7)`,
          backgroundImage: GRID_BG,
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
            inset: -40,
            pointerEvents: "none",
            zIndex: 30,
            mixBlendMode: "overlay",
            opacity: 0,
            borderRadius: 14,
            transition: "background 0.05s linear",
          }}
        />

        {/* ── HEADER (36px): make/model left, year right ──────────────── */}
        <div
          style={{
            height: HEADER_H,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            background: "rgba(8,8,15,0.85)",
            borderBottom: `1px solid ${CARD_BORDER_COLOR}28`,
            position: "relative",
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "0.15em",
              color: "rgba(180,160,220,0.7)",
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
              fontFamily: "ui-monospace, monospace",
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(180,160,220,0.55)",
              flexShrink: 0,
            }}
          >
            {yearStr}
          </div>
        </div>

        {/* ── ART WINDOW (220px) ─────────────────────────────────────────── */}
        <div
          style={{
            height: ART_H,
            flexShrink: 0,
            position: "relative",
            background: "#0d0d1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
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
              position: "relative",
              zIndex: 2,
            }}
          />

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
              <ShieldCheck size={8} style={{ color: CARD_GOLD }} />
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 7,
                  fontWeight: 900,
                  letterSpacing: "0.15em",
                  color: CARD_GOLD,
                  textTransform: "uppercase" as const,
                }}
              >
                VIN
              </span>
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 10,
              fontFamily: "ui-monospace, monospace",
              fontSize: 6,
              fontWeight: 900,
              letterSpacing: "0.25em",
              color: "rgba(180,160,220,0.25)",
              userSelect: "none",
              zIndex: 3,
            }}
          >
            MODVAULT
          </div>
        </div>

        {/* ── STATS PANEL (84px) ─────────────────────────────────────────── */}
        <div
          style={{
            height: STATS_H,
            flexShrink: 0,
            background: "rgba(8,8,15,0.85)",
            borderTop: `1px solid ${CARD_BORDER_COLOR}22`,
            padding: "10px 14px 8px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            zIndex: 5,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
            {[
              { label: "PWR",  value: hp != null ? `${hp}` : "—" },
              { label: "MODS", value: modCount != null ? String(modCount) : "—" },
              { label: "SCORE", value: buildScore != null ? String(buildScore) : "—" },
              { label: "MINT", value: mintDate },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: i % 2 === 0 ? "flex-start" : "flex-end" }}>
                <div style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 7,
                  fontWeight: 700,
                  color: "rgba(180,160,220,0.45)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase" as const,
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.85)",
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Divider line */}
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, transparent 0%, ${CARD_BORDER_COLOR}55 50%, transparent 100%)`,
            marginTop: 4,
          }} />
        </div>

        {/* ── FOOTER (40px): nickname centered ─────────────────────────── */}
        <div
          style={{
            height: FOOTER_H,
            flexShrink: 0,
            background: "rgba(8,8,15,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 14px",
            position: "relative",
            zIndex: 5,
          }}
        >
          <span style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            fontWeight: 900,
            color: CARD_GOLD,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            textAlign: "center" as const,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
            maxWidth: "100%",
          }}>
            {nickname}
          </span>

          {showShare && onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              title="Share card"
              style={{
                position: "absolute",
                right: 10,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.4)",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Share2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

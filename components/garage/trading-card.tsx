"use client";

import { useRef, useState, useCallback } from "react";
import { Share2, ShieldCheck, RotateCcw } from "lucide-react";
import { CARD_BORDER_COLOR, CARD_BORDER_GLOW, CARD_GOLD, ERA_COLORS, RARITY_COLORS, safeEra, safeRarity } from "@/lib/pixel-card";

export interface TradingCardData {
  cardUrl: string;
  nickname: string;
  generatedAt: string | null;
  hp: number | null;
  modCount: number | null;
  buildScore: number | null;
  vinVerified?: boolean;
  cardNumber?: number | null;
  era?: string | null;
  rarity?: string | null;
  flavorText?: string | null;
  occasion?: string | null;
  mods?: string[];
  modsDetail?: { name: string; cost: number | null; category?: string }[];
  edition?: number | null;
  torque?: number | null;
  zeroToSixty?: number | null;
  totalInvested?: number | null;
  personality?: string | null;
  cardLevel?: number | null;
}

interface TradingCardProps extends TradingCardData {
  carLabel: string;
  scale?: number;
  idle?: boolean;
  interactive?: boolean;
  showShare?: boolean;
  onShare?: () => void;
  /** Controlled flip state. If provided, the component uses this instead of internal state. */
  flipped?: boolean;
  /** Called when the user clicks a flip button (controlled mode). */
  onFlipChange?: (v: boolean) => void;
  /** When true, renders a dead/burned visual treatment (no grayscale — uses charred red+black). */
  dead?: boolean;
  /** Wiggle animation for speaking state */
  wiggle?: boolean;
}

const CARD_W   = 280;
const HEADER_H = 42;
const ART_H    = 198;
const ERA_H    = 26;
const STATS_H  = 72;
const FOOTER_H = 32;
const CARD_H   = HEADER_H + ART_H + ERA_H + STATS_H + FOOTER_H; // 370

// Paper / metal-leaf texture — scanlines + diagonal sheen + cross-hatch.
// Gives the card a real printed feel rather than a flat panel.
const PAPER_TEXTURE = [
  // Diagonal noise
  "repeating-linear-gradient(43deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px)",
  "repeating-linear-gradient(-43deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 5px)",
  // Horizontal scanlines
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px)",
  // Subtle fibers
  "repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 6px)",
].join(", ");


function fmt(n: number): string {
  return String(n).padStart(4, "0");
}

export function TradingCard({
  cardUrl,
  nickname,
  generatedAt,
  hp,
  modCount,
  buildScore,
  vinVerified = false,
  cardNumber,
  era: eraProp,
  rarity: rarityProp,
  flavorText,
  occasion,
  mods = [],
  modsDetail,
  edition,
  torque,
  zeroToSixty,
  totalInvested,
  personality,
  cardLevel,
  carLabel,
  scale = 1,
  idle = true,
  interactive = true,
  showShare = false,
  onShare,
  flipped: flippedProp,
  onFlipChange,
  dead = false,
  wiggle = false,
}: TradingCardProps) {
  const era         = safeEra(eraProp);
  const eraStyle    = ERA_COLORS[era];
  const rarity      = safeRarity(rarityProp);
  const rarityStyle = RARITY_COLORS[rarity];
  const isLegendary = rarity === "Legendary";

  // outerRef is the tilt div (center-center scaled)
  const outerRef   = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, over: false });
  const rafRef     = useRef(0);

  // Controlled vs uncontrolled flip
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isControlled = flippedProp !== undefined;
  const flipped = isControlled ? flippedProp : internalFlipped;

  function doFlip(v: boolean) {
    if (!isControlled) setInternalFlipped(v);
    onFlipChange?.(v);
  }

  const parts     = carLabel.split(" ");
  const yearMatch = parts[0]?.match(/^\d{4}$/);
  const yearStr   = yearMatch ? parts[0] : "";
  const nameStr   = yearMatch ? parts.slice(1).join(" ") : carLabel;

  const mintDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })
    : "--/--/--";

  const scheduleTilt = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!outerRef.current || !pointerRef.current.over) return;
      const { x, y } = pointerRef.current;
      // ±6 deg max, scale 1.02 on hover — centered pivot
      const rx = (y - 0.5) * -12; // maps 0-1 → -6..+6
      const ry = (x - 0.5) * 12;
      // Perspective lives on the outer wrapper, don't stack it here.
      outerRef.current.style.transform = `scale(${scale * 1.02}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      // Soft white glare — low opacity radial following mouse
      if (shimmerRef.current) {
        shimmerRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`;
        shimmerRef.current.style.opacity = "1";
      }
      if (pointerRef.current.over) scheduleTilt();
    });
  }, [scale]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    // Measure against the outer wrapper (which is CARD_W*scale × CARD_H*scale)
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    pointerRef.current = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      over: true,
    };
    scheduleTilt();
  }

  function onMouseLeave() {
    if (!interactive) return;
    pointerRef.current.over = false;
    if (outerRef.current) {
      // Smooth snap-back. Keep the transform set to the base `scale(${scale})`
      // permanently — never clear the inline transform, which would otherwise
      // cause a 1-frame flash of "no transform" and a visible jolt.
      outerRef.current.style.transition = "transform 300ms cubic-bezier(0.23,1,0.32,1)";
      outerRef.current.style.transform = `scale(${scale})`;
      setTimeout(() => {
        if (outerRef.current) {
          // Reset transition to the 80ms default so the next hover feels responsive.
          outerRef.current.style.transition = "transform 80ms ease";
        }
      }, 310);
    }
    if (shimmerRef.current) {
      shimmerRef.current.style.transition = "opacity 0.3s";
      shimmerRef.current.style.opacity = "0";
      setTimeout(() => {
        if (shimmerRef.current) shimmerRef.current.style.transition = "";
      }, 310);
    }
  }

  // Unique key per scale value for scoped CSS animation name
  const scaleKey = scale.toString().replace(".", "_").replace("-", "n");

  // ── Distinct "card paper" colors, era-tinted so the card stands out from the bg.
  // Each era uses a richer base color that cannot be confused with the page background.
  const cardPaper = (() => {
    if (dead) {
      return {
        base: "#1a0808",
        gradient: "linear-gradient(158deg, #2a0f0f 0%, #1a0808 50%, #0d0303 100%)",
        edge: "rgba(180,40,40,0.5)",
        tint: "rgba(180,40,40,0.15)",
      };
    }
    switch (era) {
      case "Dawn":
        return {
          base: "#1c1305",
          gradient: "linear-gradient(158deg, #2a1d08 0%, #1f1507 55%, #120a02 100%)",
          edge: "rgba(245,166,35,0.35)",
          tint: "rgba(245,166,35,0.08)",
        };
      case "Chrome":
        return {
          base: "#111218",
          gradient: "linear-gradient(158deg, #1e2030 0%, #131520 55%, #0a0b12 100%)",
          edge: "rgba(192,200,220,0.32)",
          tint: "rgba(192,200,220,0.06)",
        };
      case "Turbo":
        return {
          base: "#1a0807",
          gradient: "linear-gradient(158deg, #2b0d0a 0%, #1d0605 55%, #0e0201 100%)",
          edge: "rgba(255,59,48,0.35)",
          tint: "rgba(255,59,48,0.08)",
        };
      case "Neon":
        return {
          base: "#041810",
          gradient: "linear-gradient(158deg, #072519 0%, #041810 55%, #020c08 100%)",
          edge: "rgba(0,255,136,0.32)",
          tint: "rgba(0,255,136,0.07)",
        };
      case "Apex":
      default:
        return {
          base: "#150a28",
          gradient: "linear-gradient(158deg, #22113e 0%, #170b2a 55%, #0a0415 100%)",
          edge: "rgba(168,85,247,0.35)",
          tint: "rgba(168,85,247,0.10)",
        };
    }
  })();

  const borderColor = dead
    ? "rgba(180,40,40,0.7)"
    : isLegendary
      ? "rgba(245,215,110,0.75)"
      : cardPaper.edge;

  const boxShadow = dead
    ? `0 0 28px rgba(180,40,40,0.4), 0 0 8px rgba(180,40,40,0.25), 0 14px 44px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)`
    : isLegendary
      ? `0 0 26px rgba(245,215,110,0.55), 0 0 8px rgba(245,215,110,0.3), 0 14px 44px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)`
      : `0 0 26px ${eraStyle.glow}, 0 0 6px ${CARD_BORDER_GLOW}, 0 14px 44px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)`;

  // Compute power delta vs stock for a richer stat line
  const powerPct = hp != null && hp > 0 ? Math.min(100, Math.round((hp / 1000) * 100)) : 0;

  return (
    // ── Outer wrapper: mouse events, sized to scaled card.
    // CRITICAL: perspective lives here so the 3D flip has depth. All ancestors
    // between here and the flip container MUST have transform-style: preserve-3d
    // or backface-visibility gets flattened and the front face bleeds through
    // the back face.
    <div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        width: CARD_W * scale,
        height: CARD_H * scale,
        position: "relative",
        cursor: interactive ? "default" : "pointer",
        perspective: "1200px",
        WebkitPerspective: "1200px",
        transformStyle: "preserve-3d",
        WebkitTransformStyle: "preserve-3d",
      }}
    >
      <style>{`
        /* Idle float: translate via top/left instead of transform so we
           don't create a 2D rendering context that flattens the 3D chain. */
        @keyframes tcFloat_${scaleKey} {
          0%,100% { top: 0px; }
          50%     { top: -6px; }
        }
        .tc-idle-${scaleKey} {
          animation: tcFloat_${scaleKey} 3.4s ease-in-out infinite;
        }
        .tc-idle-${scaleKey}:hover {
          animation-play-state: paused;
        }
        /* Wiggle: when the card is speaking */
        @keyframes tcWiggle_${scaleKey} {
          0%, 100% { top: 0; transform: rotate(0deg); }
          12%  { top: -3px; transform: rotate(-1.4deg); }
          26%  { top: -1px; transform: rotate(1.2deg); }
          41%  { top: -4px; transform: rotate(-0.9deg); }
          58%  { top: -2px; transform: rotate(1.1deg); }
          74%  { top: -3px; transform: rotate(-0.6deg); }
          88%  { top: -1px; transform: rotate(0.8deg); }
        }
        .tc-wiggle-${scaleKey} {
          animation: tcWiggle_${scaleKey} 1.1s ease-in-out infinite;
        }
        /* Legendary card: animated gold border shimmer */
        @keyframes legendaryShimmer_${scaleKey} {
          0%   { box-shadow: 0 0 26px rgba(245,215,110,0.55), 0 0 8px rgba(245,215,110,0.3), 0 14px 44px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08); border-color: rgba(245,215,110,0.65); }
          50%  { box-shadow: 0 0 42px rgba(245,215,110,0.85), 0 0 18px rgba(245,215,110,0.55), 0 14px 44px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.12); border-color: rgba(245,215,110,0.95); }
          100% { box-shadow: 0 0 26px rgba(245,215,110,0.55), 0 0 8px rgba(245,215,110,0.3), 0 14px 44px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08); border-color: rgba(245,215,110,0.65); }
        }
        .tc-legendary-${scaleKey} {
          animation: legendaryShimmer_${scaleKey} 2.4s ease-in-out infinite !important;
        }
        /* Dead card: soft charred smolder */
        @keyframes deadSmolder_${scaleKey} {
          0%, 100% { box-shadow: 0 0 28px rgba(180,40,40,0.4), 0 0 8px rgba(180,40,40,0.25), 0 14px 44px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04); }
          50%      { box-shadow: 0 0 38px rgba(220,60,60,0.55), 0 0 16px rgba(220,60,60,0.35), 0 14px 44px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06); }
        }
        .tc-dead-${scaleKey} {
          animation: deadSmolder_${scaleKey} 3.8s ease-in-out infinite !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-idle-${scaleKey},
          .tc-wiggle-${scaleKey},
          .tc-legendary-${scaleKey},
          .tc-dead-${scaleKey} { animation: none !important; }
        }
      `}</style>

      {/* ── Idle float / wiggle layer — uses top/left animation (no transform)
           so the 3D context of its children is preserved. */}
      <div
        className={wiggle ? `tc-wiggle-${scaleKey}` : (idle ? `tc-idle-${scaleKey}` : "")}
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
        }}
      >
        {/* ── Tilt + scale layer (center-center origin) ──────────────────── */}
        <div
          ref={outerRef}
          style={{
            width: CARD_W,
            height: CARD_H,
            position: "absolute",
            top: "50%",
            left: "50%",
            marginLeft: -(CARD_W / 2),
            marginTop: -(CARD_H / 2),
            transformOrigin: "center center",
            transform: `scale(${scale})`,
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            transition: "transform 80ms ease",
            willChange: "transform",
          }}
        >
          {/* ── Flip container ──────────────────────────────────────────── */}
          <div
            style={{
              width: CARD_W,
              height: CARD_H,
              position: "relative",
              transformStyle: "preserve-3d",
              WebkitTransformStyle: "preserve-3d",
              transition: "transform 0.65s cubic-bezier(0.4,0,0.2,1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >

            {/* ══════════ FRONT FACE ═══════════════════════════════════ */}
            <div
              className={
                dead ? `tc-dead-${scaleKey}` :
                isLegendary ? `tc-legendary-${scaleKey}` : ""
              }
              style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg) translateZ(0.1px)",
              borderRadius: 16,
              border: `2px solid ${borderColor}`,
              boxShadow,
              // Solid opaque base color FIRST to prevent any transparency bleed,
              // textures layered on top.
              backgroundColor: cardPaper.base,
              backgroundImage: `${PAPER_TEXTURE}, ${cardPaper.gradient}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}>

              {/* Era tint wash — pushes the card even further from bg */}
              <div aria-hidden style={{
                position: "absolute", inset: 0,
                background: cardPaper.tint,
                mixBlendMode: "screen",
                pointerEvents: "none",
                zIndex: 0,
              }} />

              {/* Soft white glare — follows mouse. Lives inside the front
                  face so it flips away cleanly with the card. */}
              <div
                ref={shimmerRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  zIndex: 40,
                  mixBlendMode: "screen",
                  opacity: 0,
                  borderRadius: 14,
                }}
              />

              {/* Inner bevel — gives the card a physical edge so it doesn't look flat */}
              <div aria-hidden style={{
                position: "absolute", inset: 3,
                borderRadius: 13,
                border: `1px solid rgba(255,255,255,0.05)`,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.4)",
                pointerEvents: "none",
                zIndex: 1,
              }} />

              {/* HEADER */}
              <div style={{
                height: HEADER_H, flexShrink: 0, position: "relative", zIndex: 2,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 13px 0 15px",
                background: dead
                  ? "linear-gradient(180deg, rgba(40,10,10,0.85) 0%, rgba(25,5,5,0.75) 100%)"
                  : `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)`,
                borderBottom: `1px solid ${cardPaper.edge}`,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden", flex: 1 }}>
                  <span style={{
                    fontFamily: "ui-monospace, 'SFMono-Regular', monospace",
                    fontSize: 10, fontWeight: 900,
                    textTransform: "uppercase" as const, letterSpacing: "0.14em",
                    color: dead ? "rgba(250,200,200,0.85)" : "rgba(240,230,255,0.92)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}>
                    {nameStr}
                  </span>
                  {yearStr && (
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                      color: dead ? "rgba(220,150,150,0.6)" : eraStyle.text,
                      flexShrink: 0, opacity: 0.75,
                    }}>
                      {yearStr}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 8 }}>
                  {edition != null && edition > 1 && (
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 700,
                      color: "rgba(200,180,240,0.4)", letterSpacing: "0.1em",
                    }}>
                      Ed.{edition}
                    </span>
                  )}
                  {cardNumber != null && (
                    <div style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 900,
                      color: dead ? "#fca5a5" : eraStyle.text, letterSpacing: "0.1em",
                      padding: "2px 7px", borderRadius: 5,
                      background: dead ? "rgba(180,40,40,0.2)" : eraStyle.bg,
                      border: `1px solid ${dead ? "rgba(180,40,40,0.5)" : eraStyle.border}`,
                      boxShadow: `0 0 6px ${dead ? "rgba(180,40,40,0.3)" : eraStyle.glow}`,
                    }}>
                      #{fmt(cardNumber)}
                    </div>
                  )}
                </div>
              </div>

              {/* ART ZONE — image never shown on back (backfaceVisibility: hidden on this face) */}
              <div style={{
                height: ART_H, flexShrink: 0, position: "relative", zIndex: 2,
                background: dead
                  ? "radial-gradient(ellipse at 50% 55%, rgba(80,15,15,0.6) 0%, rgba(20,5,5,0.8) 70%)"
                  : `radial-gradient(ellipse at 50% 55%, ${eraStyle.glow} 0%, transparent 62%), rgba(0,0,0,0.25)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {/* Corner reticle decorations */}
                {([
                  { top: 6, left: 6, deg: 0 },
                  { top: 6, right: 6, deg: 90 },
                  { bottom: 6, right: 6, deg: 180 },
                  { bottom: 6, left: 6, deg: 270 },
                ] as const).map((pos, i) => {
                  const { deg, ...anchor } = pos;
                  return (
                    <div key={i} aria-hidden style={{
                      position: "absolute",
                      ...anchor,
                      width: 12, height: 12,
                      transform: `rotate(${deg}deg)`,
                      borderTop: `1.5px solid ${dead ? "rgba(220,80,80,0.6)" : eraStyle.text}`,
                      borderLeft: `1.5px solid ${dead ? "rgba(220,80,80,0.6)" : eraStyle.text}`,
                      opacity: 0.55,
                      pointerEvents: "none",
                      zIndex: 4,
                    }} />
                  );
                })}

                {/* Era-colored border — no inner padding so the image fills to the frame edge */}
                <div style={{
                  position: "relative",
                  border: `2px solid ${dead ? "rgba(180,40,40,0.6)" : eraStyle.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: `0 0 16px ${dead ? "rgba(180,40,40,0.35)" : eraStyle.glow}, inset 0 0 20px rgba(0,0,0,0.35)`,
                  zIndex: 2,
                  lineHeight: 0,
                  background: "#0a0a18",
                }}>
                {/* Source images are square (512×512). Render as 184×184 square
                    so nothing is cropped. `contain` is a safety net in case a
                    future generator returns a non-square aspect. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cardUrl} alt={nickname} width={184} height={184}
                  style={{
                    width: 184, height: 184,
                    objectFit: "contain",
                    imageRendering: "pixelated",
                    display: "block",
                    background: dead ? "#1a0606" : "#0a0a18",
                    filter: dead ? "brightness(0.55) sepia(0.6) hue-rotate(-30deg) saturate(1.1)" : "none",
                  }}
                />
                </div>

                {/* Burned stamp on dead cards */}
                {dead && (
                  <div aria-hidden style={{
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%) rotate(-14deg)",
                    padding: "4px 14px",
                    border: "2.5px solid rgba(255,90,90,0.65)",
                    borderRadius: 6,
                    color: "rgba(255,100,100,0.85)",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    background: "rgba(20,0,0,0.55)",
                    boxShadow: "0 0 20px rgba(180,40,40,0.4), inset 0 0 10px rgba(180,40,40,0.3)",
                    pointerEvents: "none",
                    zIndex: 5,
                    textShadow: "0 0 8px rgba(180,40,40,0.6)",
                  }}>
                    Burned
                  </div>
                )}

                {vinVerified && !dead && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "3px 7px", borderRadius: 5,
                    background: "rgba(245,215,110,0.14)",
                    border: "1px solid rgba(245,215,110,0.55)",
                    boxShadow: "0 0 8px rgba(245,215,110,0.35)",
                    zIndex: 5,
                  }}>
                    <ShieldCheck size={8} style={{ color: CARD_GOLD }} />
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900,
                      letterSpacing: "0.15em", color: CARD_GOLD, textTransform: "uppercase" as const,
                    }}>VIN</span>
                  </div>
                )}

                {/* MODVAULT watermark */}
                <div style={{
                  position: "absolute", bottom: 5, left: 10,
                  fontFamily: "ui-monospace, monospace", fontSize: 6, fontWeight: 900,
                  letterSpacing: "0.28em",
                  color: dead ? "rgba(180,60,60,0.3)" : "rgba(200,180,240,0.22)",
                  userSelect: "none", zIndex: 3,
                }}>
                  MODVAULT
                </div>
              </div>

              {/* ERA STRIP — era left · personality center · level+rarity right */}
              <div style={{
                height: ERA_H, flexShrink: 0, position: "relative", zIndex: 2,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 9px",
                background: dead
                  ? "linear-gradient(180deg, rgba(25,5,5,0.85) 0%, rgba(15,3,3,0.78) 100%)"
                  : "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)",
                borderTop: `1px solid ${cardPaper.edge}`,
                borderBottom: `1px solid ${cardPaper.edge}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "2px 8px", borderRadius: 20,
                  background: dead ? "rgba(180,40,40,0.2)" : eraStyle.bg,
                  border: `1px solid ${dead ? "rgba(180,40,40,0.5)" : eraStyle.border}`,
                  boxShadow: `0 0 8px ${dead ? "rgba(180,40,40,0.3)" : eraStyle.glow}`,
                }}>
                  <div style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: dead ? "#fca5a5" : eraStyle.text,
                    boxShadow: `0 0 4px ${dead ? "#fca5a5" : eraStyle.text}`,
                  }} />
                  <span style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900,
                    letterSpacing: "0.18em", textTransform: "uppercase" as const,
                    color: dead ? "#fca5a5" : eraStyle.text,
                  }}>
                    {dead ? "Ghost" : era}
                  </span>
                </div>

                {/* Personality — center, the card's identity */}
                {personality && (
                  <span style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900,
                    letterSpacing: "0.14em", textTransform: "uppercase" as const,
                    color: dead ? "rgba(220,150,150,0.55)" : "rgba(220,205,255,0.6)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                    maxWidth: 92,
                  }}>
                    {personality.replace("The ", "")}
                  </span>
                )}

                {/* Level + rarity right */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {cardLevel != null && (
                    <span style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900,
                      letterSpacing: "0.1em", color: "rgba(245,215,110,0.75)",
                      padding: "1px 5px", borderRadius: 4,
                      background: "rgba(245,215,110,0.1)", border: "1px solid rgba(245,215,110,0.25)",
                    }}>
                      LVL {cardLevel}
                    </span>
                  )}
                  {rarity !== "Common" && !dead && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "2px 7px", borderRadius: 20,
                      background: rarityStyle.bg, border: `1px solid ${rarityStyle.border}`,
                      boxShadow: isLegendary ? `0 0 10px ${rarityStyle.glow}` : "none",
                    }}>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900,
                        letterSpacing: "0.14em", textTransform: "uppercase" as const, color: rarityStyle.text,
                      }}>
                        {rarity}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* STATS — HP / Torque / 0-60 / Mods / Invested + power bar */}
              <div style={{
                height: STATS_H, flexShrink: 0, position: "relative", zIndex: 2,
                background: dead
                  ? "linear-gradient(180deg, rgba(20,5,5,0.85) 0%, rgba(10,2,2,0.9) 100%)"
                  : "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)",
                padding: "8px 12px 6px",
                display: "flex", flexDirection: "column", gap: 5,
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
                  {[
                    { label: "HP",    value: hp != null ? String(hp) : "—" },
                    { label: "TRQ",   value: torque != null ? String(torque) : "—" },
                    { label: "0-60",  value: zeroToSixty != null ? zeroToSixty.toFixed(1) + "s" : "—" },
                    { label: "MODS",  value: modCount != null ? String(modCount) : "—" },
                    { label: "SPENT", value: totalInvested != null && totalInvested > 0
                                              ? "$" + (totalInvested >= 1000 ? (totalInvested / 1000).toFixed(1) + "k" : String(totalInvested))
                                              : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 6, fontWeight: 700,
                        letterSpacing: "0.12em", textTransform: "uppercase" as const,
                        color: dead ? "rgba(180,120,120,0.45)" : "rgba(180,160,220,0.5)",
                      }}>
                        {label}
                      </span>
                      <span style={{
                        fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900,
                        color: dead ? "rgba(240,200,200,0.85)" : "rgba(245,238,255,0.97)",
                        letterSpacing: "-0.01em",
                      }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Power bar — visual strength indicator */}
                <div style={{
                  position: "relative",
                  height: 3,
                  borderRadius: 2,
                  background: dead ? "rgba(180,40,40,0.15)" : "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                  border: dead ? "none" : `1px solid rgba(255,255,255,0.04)`,
                }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${powerPct}%`,
                    background: dead
                      ? "linear-gradient(90deg, rgba(180,40,40,0.6), rgba(250,100,100,0.8))"
                      : `linear-gradient(90deg, ${eraStyle.text}, ${eraStyle.text}aa)`,
                    boxShadow: dead ? "0 0 8px rgba(220,60,60,0.5)" : `0 0 8px ${eraStyle.glow}`,
                    borderRadius: 2,
                  }} />
                </div>
              </div>

              {/* FOOTER */}
              <div style={{
                height: FOOTER_H, flexShrink: 0, position: "relative", zIndex: 2,
                background: dead
                  ? "linear-gradient(180deg, rgba(15,3,3,0.9) 0%, rgba(8,1,1,0.95) 100%)"
                  : "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.92) 100%)",
                display: "flex", alignItems: "center",
                padding: "0 10px", gap: 6,
                borderTop: `1px solid ${cardPaper.edge}`,
              }}>
                {interactive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); doFlip(true); }}
                    title="Flip card [F]"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      color: dead ? "rgba(220,150,150,0.35)" : "rgba(200,180,240,0.35)",
                      padding: 4, display: "flex", flexShrink: 0,
                    }}
                  >
                    <RotateCcw size={10} />
                  </button>
                )}
                <span style={{
                  flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 900,
                  color: dead ? "#fca5a5" : CARD_GOLD,
                  letterSpacing: "0.05em", textTransform: "uppercase" as const,
                  textAlign: "center" as const,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                  textShadow: dead ? "0 0 6px rgba(180,40,40,0.4)" : "0 0 6px rgba(245,215,110,0.25)",
                }}>
                  {nickname}
                </span>
                {showShare && onShare && (
                  <button onClick={(e) => { e.stopPropagation(); onShare(); }} title="Share"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      color: dead ? "rgba(220,150,150,0.35)" : "rgba(200,180,240,0.35)",
                      padding: 4, display: "flex", flexShrink: 0,
                    }}>
                    <Share2 size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* ══════════ BACK FACE — Textured MODVAULT card back ══════════ */}
            <div style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(0.1px)",
              borderRadius: 16,
              border: `2px solid ${dead ? "rgba(180,40,40,0.7)" : CARD_BORDER_COLOR}`,
              boxShadow: dead
                ? `0 0 26px rgba(180,40,40,0.45), 0 14px 44px rgba(0,0,0,0.85)`
                : `0 0 26px rgba(123,79,212,0.45), 0 14px 44px rgba(0,0,0,0.75)`,
              // Opaque deep base — solid first so no bleed-through ever.
              backgroundColor: dead ? "#180404" : "#13072b",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              isolation: "isolate",
            }}>
              {/* Layer 1: diagonal crosshatch base texture */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 0, zIndex: 0,
                backgroundColor: dead ? "#180404" : "#13072b",
                backgroundImage: dead ? [
                  "repeating-linear-gradient(45deg, rgba(220,60,60,0.10) 0 2px, transparent 2px 10px)",
                  "repeating-linear-gradient(-45deg, rgba(220,60,60,0.08) 0 2px, transparent 2px 10px)",
                  "radial-gradient(ellipse at 50% 50%, rgba(220,60,60,0.35) 0%, transparent 70%)",
                  "linear-gradient(180deg, #220a0a 0%, #180404 50%, #0a0101 100%)",
                ].join(", ") : [
                  "repeating-linear-gradient(45deg, rgba(168,85,247,0.10) 0 2px, transparent 2px 10px)",
                  "repeating-linear-gradient(-45deg, rgba(168,85,247,0.08) 0 2px, transparent 2px 10px)",
                  "radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.35) 0%, transparent 70%)",
                  "linear-gradient(180deg, #1c0d3d 0%, #13072b 50%, #0a0418 100%)",
                ].join(", "),
              }} />

              {/* Layer 2: tiled tiny MODVAULT logo stamps */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 0, zIndex: 1,
                opacity: 0.12,
                backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><g fill='none' stroke='%23e9d5ff' stroke-width='1.2' stroke-linejoin='round'><path d='M6 18l4-10h8l4 10z'/></g><circle cx='10' cy='19.5' r='1.6' fill='%23e9d5ff'/><circle cx='18' cy='19.5' r='1.6' fill='%23e9d5ff'/></svg>\")",
                backgroundSize: "28px 28px",
                backgroundRepeat: "repeat",
              }} />

              {/* Layer 3: decorative corner borders */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 6, zIndex: 2,
                border: `2px solid ${dead ? "rgba(220,60,60,0.55)" : "rgba(168,85,247,0.55)"}`,
                borderRadius: 10, pointerEvents: "none",
                boxShadow: `inset 0 0 14px ${dead ? "rgba(220,60,60,0.2)" : "rgba(168,85,247,0.2)"}`,
              }} />
              <div aria-hidden="true" style={{
                position: "absolute", inset: 12, zIndex: 2,
                border: "1px dashed rgba(245,215,110,0.28)",
                borderRadius: 6, pointerEvents: "none",
              }} />

              {/* Layer 4: corner diamonds */}
              {[
                { top: 14, left: 14 }, { top: 14, right: 14 },
                { bottom: 14, left: 14 }, { bottom: 14, right: 14 },
              ].map((pos, i) => (
                <div key={i} aria-hidden="true" style={{
                  position: "absolute", zIndex: 2,
                  width: 6, height: 6,
                  background: "rgba(245,215,110,0.55)",
                  transform: "rotate(45deg)",
                  ...pos,
                }} />
              ))}

              {/* Centered: big MODVAULT logo + wordmark */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
                position: "relative", zIndex: 3,
              }}>
                {/* Circular frame around logo */}
                <div style={{
                  width: 118, height: 118, borderRadius: "50%",
                  background: dead
                    ? "radial-gradient(circle, rgba(40,10,10,0.95) 0%, rgba(24,4,4,0.98) 100%)"
                    : "radial-gradient(circle, rgba(26,11,58,0.95) 0%, rgba(19,7,43,0.98) 100%)",
                  border: "2px solid rgba(245,215,110,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: dead
                    ? "0 0 30px rgba(220,60,60,0.5), inset 0 0 20px rgba(220,60,60,0.3), 0 0 0 4px rgba(220,60,60,0.15)"
                    : "0 0 30px rgba(168,85,247,0.5), inset 0 0 20px rgba(168,85,247,0.3), 0 0 0 4px rgba(168,85,247,0.15)",
                  position: "relative",
                }}>
                  {/* Inner ring */}
                  <div aria-hidden="true" style={{
                    position: "absolute", inset: 6,
                    borderRadius: "50%",
                    border: `1px solid ${dead ? "rgba(220,60,60,0.6)" : "rgba(168,85,247,0.6)"}`,
                  }} />
                  {/* Big logo mark */}
                  <div style={{
                    width: 78, height: 78, borderRadius: 20,
                    background: dead
                      ? "linear-gradient(135deg, #8b1a1a 0%, #dc2626 100%)"
                      : "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                    border: "2px solid rgba(255,255,255,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "inset 0 2px 10px rgba(255,255,255,0.2), 0 4px 14px rgba(0,0,0,0.4)",
                    position: "relative",
                    zIndex: 1,
                  }}>
                    <svg width="44" height="44" viewBox="0 0 14 14" fill="none">
                      <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                      <circle cx="4.5" cy="10" r="1" fill="white" />
                      <circle cx="9.5" cy="10" r="1" fill="white" />
                    </svg>
                  </div>
                </div>

                {/* MODVAULT wordmark */}
                <div style={{ textAlign: "center" }}>
                  <p style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 19, fontWeight: 900,
                    letterSpacing: "0.34em", textTransform: "uppercase",
                    color: "#fff", margin: "0 0 4px",
                    textShadow: dead
                      ? "0 0 18px rgba(220,60,60,0.9), 0 2px 4px rgba(0,0,0,0.6)"
                      : "0 0 18px rgba(168,85,247,0.9), 0 2px 4px rgba(0,0,0,0.6)",
                  }}>
                    MODVAULT
                  </p>
                  <p style={{
                    fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 700,
                    letterSpacing: "0.38em", textTransform: "uppercase",
                    color: dead ? "rgba(245,215,110,0.5)" : "rgba(245,215,110,0.7)", margin: 0,
                  }}>
                    {dead ? "· Ghost Card ·" : "· Pixel Card ·"}
                  </p>
                </div>
              </div>

              {/* Invisible flip-back button — tap anywhere to flip back */}
              {interactive && (
                <button
                  onClick={(e) => { e.stopPropagation(); doFlip(false); }}
                  title="Flip [F]"
                  aria-label="Flip to front"
                  style={{
                    position: "absolute", inset: 0, zIndex: 3,
                    background: "transparent", border: "none", cursor: "pointer",
                  }}
                />
              )}
            </div>

          </div>{/* /flip container */}
        </div>{/* /tilt + scale layer */}
      </div>{/* /idle float layer */}

      {/* Suppress unused import warning */}
      {false && (
        <span style={{ display: "none" }}>
          {CARD_BORDER_GLOW}
          {flavorText}
          {occasion}
          {mods.length}
          {modsDetail?.length}
          {buildScore}
          {mintDate}
        </span>
      )}
    </div>
  );
}
